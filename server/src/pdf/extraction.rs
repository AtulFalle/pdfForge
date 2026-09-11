use lopdf::content::{Content, Operation};
use lopdf::{Document, Object, ObjectId};

use super::fonts::{decode_pdf_string, font_base_name, page_font};
use super::{
    BBox, DocumentAnalysis, PageInfo, PdfError, TextRun, TextStyle, MAX_PAGE_CONTENT_BYTES,
};

#[derive(Clone, Copy)]
struct Matrix {
    a: f32,
    b: f32,
    c: f32,
    d: f32,
    e: f32,
    f: f32,
}

impl Matrix {
    fn identity() -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            e: 0.0,
            f: 0.0,
        }
    }

    fn translate(tx: f32, ty: f32) -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            e: tx,
            f: ty,
        }
    }

    fn mul(self, rhs: Self) -> Self {
        Self {
            a: self.a * rhs.a + self.b * rhs.c,
            b: self.a * rhs.b + self.b * rhs.d,
            c: self.c * rhs.a + self.d * rhs.c,
            d: self.c * rhs.b + self.d * rhs.d,
            e: self.e * rhs.a + self.f * rhs.c + rhs.e,
            f: self.e * rhs.b + self.f * rhs.d + rhs.f,
        }
    }

    fn apply(self, x: f32, y: f32) -> (f32, f32) {
        (
            self.a * x + self.c * y + self.e,
            self.b * x + self.d * y + self.f,
        )
    }

    fn values(self) -> [f32; 6] {
        [self.a, self.b, self.c, self.d, self.e, self.f]
    }
}

#[derive(Clone)]
pub struct Fragment {
    pub page: u32,
    #[allow(dead_code)]
    pub page_id: ObjectId,
    pub op_index: usize,
    pub operator: String,
    pub text: String,
    pub font_name: String,
    pub font_resource: String,
    pub size: f32,
    pub color: String,
    pub transform: [f32; 6],
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

pub fn analyze(document: &Document, revision: u64) -> Result<DocumentAnalysis, PdfError> {
    let mut pages = Vec::new();
    let mut fragments = Vec::new();

    for (number, page_id) in document.get_pages() {
        pages.push(page_info(document, number, page_id)?);
        fragments.extend(extract_page_fragments(document, number, page_id)?);
    }

    Ok(DocumentAnalysis {
        revision,
        pages,
        runs: group_runs(fragments),
    })
}

pub fn extract_page_fragments(
    document: &Document,
    page: u32,
    page_id: ObjectId,
) -> Result<Vec<Fragment>, PdfError> {
    let bytes = document
        .get_page_content_with_limit(page_id, MAX_PAGE_CONTENT_BYTES)
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    let content =
        Content::decode(&bytes).map_err(|error| PdfError::Malformed(error.to_string()))?;
    interpret(document, page, page_id, &content.operations)
}

fn page_info(document: &Document, number: u32, page_id: ObjectId) -> Result<PageInfo, PdfError> {
    let page = document
        .get_dictionary(page_id)
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    let mut width = 612.0;
    let mut height = 792.0;
    if let Ok(Object::Array(box_array)) = page.get(b"MediaBox") {
        if box_array.len() == 4 {
            width = as_f32(&box_array[2]).unwrap_or(width) - as_f32(&box_array[0]).unwrap_or(0.0);
            height = as_f32(&box_array[3]).unwrap_or(height) - as_f32(&box_array[1]).unwrap_or(0.0);
        }
    }
    let rotation = page
        .get(b"Rotate")
        .ok()
        .and_then(as_f32)
        .map(|value| value as i32)
        .unwrap_or(0);
    Ok(PageInfo {
        number,
        width,
        height,
        rotation,
    })
}

fn interpret(
    document: &Document,
    page: u32,
    page_id: ObjectId,
    operations: &[Operation],
) -> Result<Vec<Fragment>, PdfError> {
    let mut fragments = Vec::new();
    let mut text_matrix = Matrix::identity();
    let mut line_matrix = Matrix::identity();
    let mut font_resource = String::from("F1");
    let mut font_name = String::from("Helvetica");
    let mut font_size = 12.0;
    let mut leading = 0.0;
    let mut color = String::from("#000000");
    let mut in_text = false;

    for (op_index, operation) in operations.iter().enumerate() {
        match operation.operator.as_str() {
            "BT" => {
                in_text = true;
                text_matrix = Matrix::identity();
                line_matrix = Matrix::identity();
            }
            "ET" => in_text = false,
            "Tf" => {
                if let Some(Object::Name(name)) = operation.operands.first() {
                    font_resource = String::from_utf8_lossy(name).into_owned();
                    if let Some(font) = page_font(document, page_id, name) {
                        font_name = font_base_name(font);
                    }
                }
                if let Some(size) = operation.operands.get(1).and_then(as_f32) {
                    font_size = size;
                }
            }
            "TL" => {
                if let Some(value) = operation.operands.first().and_then(as_f32) {
                    leading = value;
                }
            }
            "Tm" => {
                if let Some(matrix) = matrix_from_operands(&operation.operands) {
                    text_matrix = matrix;
                    line_matrix = matrix;
                }
            }
            "Td" if operation.operands.len() >= 2 => {
                let tx = as_f32(&operation.operands[0]).unwrap_or(0.0);
                let ty = as_f32(&operation.operands[1]).unwrap_or(0.0);
                line_matrix = Matrix::translate(tx, ty).mul(line_matrix);
                text_matrix = line_matrix;
            }
            "TD" if operation.operands.len() >= 2 => {
                let tx = as_f32(&operation.operands[0]).unwrap_or(0.0);
                let ty = as_f32(&operation.operands[1]).unwrap_or(0.0);
                leading = -ty;
                line_matrix = Matrix::translate(tx, ty).mul(line_matrix);
                text_matrix = line_matrix;
            }
            "T*" => {
                line_matrix = Matrix::translate(0.0, -leading).mul(line_matrix);
                text_matrix = line_matrix;
            }
            "rg" if operation.operands.len() >= 3 => {
                color = rgb_hex(
                    as_f32(&operation.operands[0]).unwrap_or(0.0),
                    as_f32(&operation.operands[1]).unwrap_or(0.0),
                    as_f32(&operation.operands[2]).unwrap_or(0.0),
                );
            }
            "g" => {
                if let Some(gray) = operation.operands.first().and_then(as_f32) {
                    color = rgb_hex(gray, gray, gray);
                }
            }
            "Tj" | "'" | "\"" if in_text => {
                if operation.operator == "'" || operation.operator == "\"" {
                    line_matrix = Matrix::translate(0.0, -leading).mul(line_matrix);
                    text_matrix = line_matrix;
                }
                if let Some(text) = operand_text(operation.operands.first()) {
                    fragments.push(fragment_from_text(
                        page,
                        page_id,
                        op_index,
                        &operation.operator,
                        text,
                        &font_name,
                        &font_resource,
                        font_size,
                        &color,
                        text_matrix,
                    ));
                    text_matrix = advance(
                        text_matrix,
                        fragments.last().map(|item| item.width).unwrap_or(0.0),
                    );
                }
            }
            "TJ" if in_text => {
                let text = tj_text(operation.operands.first());
                if !text.is_empty() {
                    fragments.push(fragment_from_text(
                        page,
                        page_id,
                        op_index,
                        "TJ",
                        text,
                        &font_name,
                        &font_resource,
                        font_size,
                        &color,
                        text_matrix,
                    ));
                    text_matrix = advance(
                        text_matrix,
                        fragments.last().map(|item| item.width).unwrap_or(0.0),
                    );
                }
            }
            _ => {}
        }
    }

    Ok(fragments)
}

#[allow(clippy::too_many_arguments)]
fn fragment_from_text(
    page: u32,
    page_id: ObjectId,
    op_index: usize,
    operator: &str,
    text: String,
    font_name: &str,
    font_resource: &str,
    size: f32,
    color: &str,
    transform: Matrix,
) -> Fragment {
    let (x, y) = transform.apply(0.0, 0.0);
    let width = estimated_width(&text, size);
    Fragment {
        page,
        page_id,
        op_index,
        operator: operator.to_string(),
        text,
        font_name: font_name.to_string(),
        font_resource: font_resource.to_string(),
        size,
        color: color.to_string(),
        transform: transform.values(),
        x,
        y,
        width,
        height: size,
    }
}

fn group_runs(fragments: Vec<Fragment>) -> Vec<TextRun> {
    let mut runs = Vec::new();
    let mut current: Vec<Fragment> = Vec::new();
    let mut index_on_page = 0;
    let mut current_page = 0_u32;

    for fragment in fragments {
        if fragment.page != current_page {
            current_page = fragment.page;
            index_on_page = 0;
        }
        let should_start_new = current.last().is_some_and(|last| {
            last.page != fragment.page
                || (fragment.y - last.y).abs() > 1.5
                || fragment.x > last.x + last.width + fragment.size
        });
        if should_start_new {
            runs.push(run_from_fragments(&current, index_on_page));
            index_on_page += 1;
            current.clear();
        }
        current.push(fragment);
    }
    if !current.is_empty() {
        runs.push(run_from_fragments(&current, index_on_page));
    }
    runs
}

fn run_from_fragments(fragments: &[Fragment], index: usize) -> TextRun {
    let first = &fragments[0];
    let last = fragments.last().unwrap_or(first);
    let text = fragments
        .iter()
        .map(|fragment| fragment.text.as_str())
        .collect::<String>();
    let width = (last.x + last.width - first.x).max(first.width);
    TextRun {
        id: format!("{}-{index}", first.page),
        page: first.page,
        text,
        bbox: BBox {
            x: first.x,
            y: first.y,
            width,
            height: first.height,
        },
        style: TextStyle {
            font_name: first.font_name.clone(),
            size: first.size,
            color: first.color.clone(),
        },
        transform: first.transform,
        source_operators: fragments
            .iter()
            .map(|fragment| fragment.operator.clone())
            .collect(),
        font_fallback: false,
    }
}

fn operand_text(object: Option<&Object>) -> Option<String> {
    match object {
        Some(Object::String(bytes, _)) => Some(decode_pdf_string(bytes)),
        _ => None,
    }
}

fn tj_text(object: Option<&Object>) -> String {
    let Some(Object::Array(items)) = object else {
        return String::new();
    };
    items
        .iter()
        .filter_map(|item| match item {
            Object::String(bytes, _) => Some(decode_pdf_string(bytes)),
            _ => None,
        })
        .collect()
}

fn estimated_width(text: &str, size: f32) -> f32 {
    size * 0.5 * text.chars().count() as f32
}

fn advance(matrix: Matrix, width: f32) -> Matrix {
    Matrix::translate(width, 0.0).mul(matrix)
}

fn matrix_from_operands(operands: &[Object]) -> Option<Matrix> {
    if operands.len() < 6 {
        return None;
    }
    Some(Matrix {
        a: as_f32(&operands[0])?,
        b: as_f32(&operands[1])?,
        c: as_f32(&operands[2])?,
        d: as_f32(&operands[3])?,
        e: as_f32(&operands[4])?,
        f: as_f32(&operands[5])?,
    })
}

fn rgb_hex(r: f32, g: f32, b: f32) -> String {
    format!(
        "#{:02X}{:02X}{:02X}",
        (r.clamp(0.0, 1.0) * 255.0).round() as u8,
        (g.clamp(0.0, 1.0) * 255.0).round() as u8,
        (b.clamp(0.0, 1.0) * 255.0).round() as u8
    )
}

pub fn as_f32(object: &Object) -> Option<f32> {
    match object {
        Object::Integer(value) => Some(*value as f32),
        Object::Real(value) => Some(*value),
        _ => None,
    }
}

pub fn page_id_for(document: &Document, page: u32) -> Result<ObjectId, PdfError> {
    document
        .get_pages()
        .get(&page)
        .copied()
        .ok_or(PdfError::PageNotFound)
}
