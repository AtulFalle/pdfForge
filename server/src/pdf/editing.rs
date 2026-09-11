use std::collections::HashMap;

use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, ObjectId, StringFormat};

use super::extraction::{analyze, extract_page_fragments, page_id_for, Fragment};
use super::fonts::{can_encode, encode_pdf_string};
use super::{DocumentAnalysis, PdfError, MAX_PAGE_CONTENT_BYTES};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct ReplaceResult {
    pub font_fallback: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct AddText {
    pub page: u32,
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub size: f32,
    pub color: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct PageRotation {
    pub page: u32,
    pub degrees: i32,
}

pub fn replace_run(
    document: &mut Document,
    run_id: &str,
    new_text: &str,
) -> Result<ReplaceResult, PdfError> {
    let located = locate_run(document, run_id)?;
    let page_id = located.page_id;
    let use_fallback = !can_encode(new_text);
    let mut content = decode_page(document, page_id)?;
    let first_index = located
        .fragments
        .first()
        .map(|fragment| fragment.op_index)
        .ok_or(PdfError::RunNotFound)?;
    let skip: std::collections::HashSet<usize> = located
        .fragments
        .iter()
        .map(|fragment| fragment.op_index)
        .collect();

    let first = &located.fragments[0];
    let safe_splice = located.fragments.len() == 1 && first.operator == "Tj" && !use_fallback;

    if safe_splice {
        let bytes = encode_pdf_string(new_text)?;
        if let Some(operation) = content.operations.get_mut(first_index) {
            if let Some(operand) = operation.operands.first_mut() {
                *operand = Object::String(bytes, StringFormat::Literal);
            }
        }
    } else {
        let mut rebuilt = Vec::with_capacity(content.operations.len() + 4);
        for (index, operation) in content.operations.iter().enumerate() {
            if index == first_index {
                rebuilt.extend(replacement_ops(first, new_text, use_fallback)?);
                continue;
            }
            if skip.contains(&index) {
                continue;
            }
            rebuilt.push(operation.clone());
        }
        content.operations = rebuilt;
    }

    write_page_content(document, page_id, &content)?;
    Ok(ReplaceResult {
        font_fallback: use_fallback,
    })
}

pub fn delete_run(document: &mut Document, run_id: &str) -> Result<(), PdfError> {
    let located = locate_run(document, run_id)?;
    let mut content = decode_page(document, located.page_id)?;
    let skip: std::collections::HashSet<usize> = located
        .fragments
        .iter()
        .map(|fragment| fragment.op_index)
        .collect();
    content.operations = content
        .operations
        .into_iter()
        .enumerate()
        .filter(|(index, _)| !skip.contains(index))
        .map(|(_, operation)| operation)
        .collect();
    write_page_content(document, located.page_id, &content)
}

pub fn add_text(document: &mut Document, request: &AddText) -> Result<(), PdfError> {
    let page_id = page_id_for(document, request.page)?;
    ensure_helvetica(document, page_id)?;
    let color = parse_hex_color(&request.color).unwrap_or((0.0, 0.0, 0.0));
    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), request.size.into()]),
            Operation::new("rg", vec![color.0.into(), color.1.into(), color.2.into()]),
            Operation::new(
                "Tm",
                vec![
                    1.into(),
                    0.into(),
                    0.into(),
                    1.into(),
                    request.x.into(),
                    request.y.into(),
                ],
            ),
            Operation::new(
                "Tj",
                vec![Object::String(
                    encode_pdf_string(&request.text)
                        .unwrap_or_else(|_| request.text.as_bytes().to_vec()),
                    StringFormat::Literal,
                )],
            ),
            Operation::new("ET", vec![]),
        ],
    };
    document
        .add_to_page_content(page_id, content)
        .map_err(|error| PdfError::Malformed(error.to_string()))
}

pub fn reorder_pages(document: &mut Document, order: &[u32]) -> Result<(), PdfError> {
    let pages = document.get_pages();
    if order.len() != pages.len() {
        return Err(PdfError::Invalid(
            "page order must list every page once".into(),
        ));
    }
    let mut seen = std::collections::HashSet::new();
    let mut new_kids = Vec::new();
    for number in order {
        if !seen.insert(*number) {
            return Err(PdfError::Invalid("duplicate page in order".into()));
        }
        new_kids.push(Object::Reference(page_id_for(document, *number)?));
    }
    set_page_kids(document, new_kids)
}

pub fn rotate_pages(document: &mut Document, rotations: &[PageRotation]) -> Result<(), PdfError> {
    for rotation in rotations {
        if rotation.degrees % 90 != 0 {
            return Err(PdfError::Invalid(
                "rotation must be a multiple of 90".into(),
            ));
        }
        let page_id = page_id_for(document, rotation.page)?;
        let page = document
            .get_dictionary_mut(page_id)
            .map_err(|error| PdfError::Malformed(error.to_string()))?;
        page.set("Rotate", rotation.degrees % 360);
    }
    Ok(())
}

pub fn delete_pages(document: &mut Document, pages: &[u32]) -> Result<(), PdfError> {
    if pages.is_empty() {
        return Ok(());
    }
    document.delete_pages(pages);
    Ok(())
}

pub fn merge_documents(base: &mut Document, extra_bytes: &[u8]) -> Result<(), PdfError> {
    let extra = super::load_pdf(extra_bytes)?;
    let dest_pages_id = pages_object_id(base)?;
    let mut map = HashMap::new();
    let extra_pages = extra.get_pages();
    let mut kids = current_kids(base)?;
    for page_id in extra_pages.values().copied() {
        let copied = copy_object(&extra, base, page_id, &mut map)?;
        if let Ok(page) = base.get_dictionary_mut(copied) {
            page.set("Parent", dest_pages_id);
        }
        kids.push(Object::Reference(copied));
    }
    set_page_kids(base, kids)
}

pub fn split_document(document: &Document, pages: &[u32]) -> Result<Vec<u8>, PdfError> {
    if pages.is_empty() {
        return Err(PdfError::Invalid("split requires at least one page".into()));
    }
    let mut created = Document::with_version("1.5");
    let pages_id = created.new_object_id();
    created.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => Vec::<Object>::new(),
            "Count" => 0,
        }),
    );
    let catalog_id = created.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    created.trailer.set("Root", catalog_id);

    let mut map = HashMap::new();
    let mut kids = Vec::new();
    for number in pages {
        let source_id = page_id_for(document, *number)?;
        let copied = copy_object(document, &mut created, source_id, &mut map)?;
        if let Ok(page) = created.get_dictionary_mut(copied) {
            page.set("Parent", pages_id);
        }
        kids.push(Object::Reference(copied));
    }
    created.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => pages.len() as i32,
        }),
    );
    super::save_pdf(&mut created)
}

struct LocatedRun {
    page_id: ObjectId,
    fragments: Vec<Fragment>,
}

fn locate_run(document: &Document, run_id: &str) -> Result<LocatedRun, PdfError> {
    let analysis = analyze(document, 0)?;
    let run = analysis
        .runs
        .iter()
        .find(|run| run.id == run_id)
        .ok_or(PdfError::RunNotFound)?;
    let page_id = page_id_for(document, run.page)?;
    let grouped = grouped_fragments(extract_page_fragments(document, run.page, page_id)?);
    let index_on_page = analysis
        .runs
        .iter()
        .filter(|item| item.page == run.page)
        .position(|item| item.id == run_id)
        .ok_or(PdfError::RunNotFound)?;
    let fragments = grouped
        .into_iter()
        .nth(index_on_page)
        .ok_or(PdfError::RunNotFound)?;
    Ok(LocatedRun { page_id, fragments })
}

fn grouped_fragments(fragments: Vec<Fragment>) -> Vec<Vec<Fragment>> {
    let mut groups = Vec::new();
    let mut current: Vec<Fragment> = Vec::new();
    for fragment in fragments {
        let should_start_new = current.last().is_some_and(|last| {
            last.page != fragment.page
                || (fragment.y - last.y).abs() > 1.5
                || fragment.x > last.x + last.width + fragment.size
        });
        if should_start_new {
            groups.push(std::mem::take(&mut current));
        }
        current.push(fragment);
    }
    if !current.is_empty() {
        groups.push(current);
    }
    groups
}

fn replacement_ops(
    first: &Fragment,
    new_text: &str,
    fallback: bool,
) -> Result<Vec<Operation>, PdfError> {
    let [a, b, c, d, e, f] = first.transform;
    let bytes = if fallback {
        encode_pdf_string(new_text).unwrap_or_else(|_| {
            new_text
                .chars()
                .map(|ch| if ch.is_ascii() { ch as u8 } else { b'?' })
                .collect()
        })
    } else {
        encode_pdf_string(new_text)?
    };
    let font = if fallback {
        "F1"
    } else {
        first.font_resource.trim_start_matches('/')
    };
    Ok(vec![
        Operation::new(
            "Tm",
            vec![a.into(), b.into(), c.into(), d.into(), e.into(), f.into()],
        ),
        Operation::new("Tf", vec![font.into(), first.size.into()]),
        Operation::new("Tj", vec![Object::String(bytes, StringFormat::Literal)]),
    ])
}

fn decode_page(document: &Document, page_id: ObjectId) -> Result<Content, PdfError> {
    let bytes = document
        .get_page_content_with_limit(page_id, MAX_PAGE_CONTENT_BYTES)
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    Content::decode(&bytes).map_err(|error| PdfError::Malformed(error.to_string()))
}

fn write_page_content(
    document: &mut Document,
    page_id: ObjectId,
    content: &Content,
) -> Result<(), PdfError> {
    let encoded = content
        .encode()
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    document
        .change_page_content(page_id, encoded)
        .map_err(|error| PdfError::Malformed(error.to_string()))
}

fn ensure_helvetica(document: &mut Document, page_id: ObjectId) -> Result<(), PdfError> {
    if super::fonts::page_font(document, page_id, b"F1").is_some() {
        return Ok(());
    }
    let font_id = document.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let page = document
        .get_dictionary_mut(page_id)
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    match page.get_mut(b"Resources") {
        Ok(Object::Dictionary(resources)) => match resources.get_mut(b"Font") {
            Ok(Object::Dictionary(fonts)) => {
                fonts.set("F1", font_id);
            }
            _ => {
                resources.set("Font", dictionary! { "F1" => font_id });
            }
        },
        _ => {
            page.set(
                "Resources",
                dictionary! {
                    "Font" => dictionary! { "F1" => font_id },
                },
            );
        }
    }
    Ok(())
}

fn pages_object_id(document: &Document) -> Result<ObjectId, PdfError> {
    let catalog = document
        .catalog()
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    match catalog.get(b"Pages") {
        Ok(Object::Reference(id)) => Ok(*id),
        _ => Err(PdfError::Malformed("missing pages tree".into())),
    }
}

fn current_kids(document: &Document) -> Result<Vec<Object>, PdfError> {
    Ok(document
        .get_pages()
        .values()
        .copied()
        .map(Object::Reference)
        .collect())
}

fn set_page_kids(document: &mut Document, kids: Vec<Object>) -> Result<(), PdfError> {
    let count = kids.len() as i32;
    let pages_id = pages_object_id(document)?;
    let parent = pages_id;
    for kid in &kids {
        if let Object::Reference(id) = kid {
            if let Ok(page) = document.get_dictionary_mut(*id) {
                page.set("Parent", parent);
            }
        }
    }
    let pages = document
        .get_dictionary_mut(pages_id)
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    pages.set("Kids", kids);
    pages.set("Count", count);
    Ok(())
}

fn copy_object(
    src: &Document,
    dest: &mut Document,
    id: ObjectId,
    map: &mut HashMap<ObjectId, ObjectId>,
) -> Result<ObjectId, PdfError> {
    if let Some(existing) = map.get(&id) {
        return Ok(*existing);
    }
    let object = src
        .get_object(id)
        .map_err(|error| PdfError::Malformed(error.to_string()))?
        .clone();
    let new_id = dest.new_object_id();
    map.insert(id, new_id);
    let remapped = remap_object(src, dest, object, map)?;
    dest.objects.insert(new_id, remapped);
    Ok(new_id)
}

fn remap_object(
    src: &Document,
    dest: &mut Document,
    object: Object,
    map: &mut HashMap<ObjectId, ObjectId>,
) -> Result<Object, PdfError> {
    match object {
        Object::Reference(id) => Ok(Object::Reference(copy_object(src, dest, id, map)?)),
        Object::Array(items) => Ok(Object::Array(
            items
                .into_iter()
                .map(|item| remap_object(src, dest, item, map))
                .collect::<Result<Vec<_>, _>>()?,
        )),
        Object::Dictionary(dict) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (key, value) in dict.into_iter() {
                new_dict.set(key, remap_object(src, dest, value, map)?);
            }
            Ok(Object::Dictionary(new_dict))
        }
        Object::Stream(mut stream) => {
            let mut new_dict = lopdf::Dictionary::new();
            for (key, value) in stream.dict.into_iter() {
                new_dict.set(key, remap_object(src, dest, value, map)?);
            }
            stream.dict = new_dict;
            Ok(Object::Stream(stream))
        }
        other => Ok(other),
    }
}

fn parse_hex_color(color: &str) -> Option<(f32, f32, f32)> {
    let hex = color.strip_prefix('#')?;
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0))
}

pub fn search_runs(analysis: &DocumentAnalysis, query: &str) -> Vec<super::TextRun> {
    let needle = query.to_lowercase();
    analysis
        .runs
        .iter()
        .filter(|run| run.text.to_lowercase().contains(&needle))
        .cloned()
        .collect()
}
