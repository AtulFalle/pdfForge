use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};

use super::{save_pdf, PdfError};

/// One-page Helvetica PDF used by tests and CLI sanity checks.
pub fn hello_pdf(text: &str) -> Result<Vec<u8>, PdfError> {
    simple_text_pdf(text, "Tj")
}

pub fn simple_text_pdf(text: &str, operator: &str) -> Result<Vec<u8>, PdfError> {
    let mut document = Document::with_version("1.5");
    let pages_id = document.new_object_id();
    let font_id = document.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let resources_id = document.add_object(dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    });

    let show = match operator {
        "TJ" => Operation::new(
            "TJ",
            vec![Object::Array(vec![Object::string_literal(text)])],
        ),
        "split" => {
            return split_tj_pdf(text);
        }
        _ => Operation::new("Tj", vec![Object::string_literal(text)]),
    };

    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), 24.into()]),
            Operation::new("rg", vec![0.into(), 0.into(), 0.into()]),
            Operation::new("Td", vec![72.into(), 720.into()]),
            show,
            Operation::new("ET", vec![]),
        ],
    };
    let encoded = content
        .encode()
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    let content_id = document.add_object(Stream::new(dictionary! {}, encoded));
    let page_id = document.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
    });
    document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
        }),
    );
    let catalog_id = document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    document.trailer.set("Root", catalog_id);
    save_pdf(&mut document)
}

pub fn split_tj_pdf(text: &str) -> Result<Vec<u8>, PdfError> {
    let (left, right) = text.split_at(text.len().max(1) / 2);
    let mut document = Document::with_version("1.5");
    let pages_id = document.new_object_id();
    let font_id = document.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let resources_id = document.add_object(dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    });
    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), 24.into()]),
            Operation::new("Td", vec![72.into(), 720.into()]),
            Operation::new("Tj", vec![Object::string_literal(left)]),
            Operation::new("Tj", vec![Object::string_literal(right)]),
            Operation::new("ET", vec![]),
        ],
    };
    let encoded = content
        .encode()
        .map_err(|error| PdfError::Malformed(error.to_string()))?;
    let content_id = document.add_object(Stream::new(dictionary! {}, encoded));
    let page_id = document.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
    });
    document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
        }),
    );
    let catalog_id = document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    document.trailer.set("Root", catalog_id);
    save_pdf(&mut document)
}

pub fn two_page_pdf() -> Result<Vec<u8>, PdfError> {
    let mut document = Document::with_version("1.5");
    let pages_id = document.new_object_id();
    let font_id = document.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let resources_id = document.add_object(dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    });

    let mut page_ids = Vec::new();
    for text in ["Page One", "Page Two"] {
        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 18.into()]),
                Operation::new("Td", vec![72.into(), 720.into()]),
                Operation::new("Tj", vec![Object::string_literal(text)]),
                Operation::new("ET", vec![]),
            ],
        };
        let encoded = content
            .encode()
            .map_err(|error| PdfError::Malformed(error.to_string()))?;
        let content_id = document.add_object(Stream::new(dictionary! {}, encoded));
        page_ids.push(document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        }));
    }

    document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_ids.into_iter().map(Object::from).collect::<Vec<_>>(),
            "Count" => 2,
        }),
    );
    let catalog_id = document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    document.trailer.set("Root", catalog_id);
    save_pdf(&mut document)
}

pub fn scanned_pdf() -> Result<Vec<u8>, PdfError> {
    let mut document = Document::with_version("1.5");
    let pages_id = document.new_object_id();
    let page_id = document.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
    });
    document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
        }),
    );
    let catalog_id = document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    document.trailer.set("Root", catalog_id);
    save_pdf(&mut document)
}
