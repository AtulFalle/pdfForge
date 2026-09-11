use lopdf::{Dictionary, Document, Object};

use super::PdfError;

pub fn decode_pdf_string(bytes: &[u8]) -> String {
    bytes.iter().copied().map(winansi_char).collect()
}

pub fn encode_pdf_string(text: &str) -> Result<Vec<u8>, PdfError> {
    let mut out = Vec::with_capacity(text.len());
    for ch in text.chars() {
        match winansi_byte(ch) {
            Some(byte) => out.push(byte),
            None => return Err(PdfError::Unencodable),
        }
    }
    Ok(out)
}

pub fn can_encode(text: &str) -> bool {
    encode_pdf_string(text).is_ok()
}

pub fn font_base_name(font: &Dictionary) -> String {
    font.get(b"BaseFont")
        .ok()
        .and_then(name_to_string)
        .or_else(|| font.get(b"Name").ok().and_then(name_to_string))
        .unwrap_or_else(|| "Unknown".to_string())
}

pub fn page_font<'a>(
    document: &'a Document,
    page_id: lopdf::ObjectId,
    font_name: &[u8],
) -> Option<&'a Dictionary> {
    let fonts = document.get_page_fonts(page_id).ok()?;
    fonts.get(font_name).copied()
}

fn name_to_string(object: &Object) -> Option<String> {
    match object {
        Object::Name(name) => Some(String::from_utf8_lossy(name).into_owned()),
        Object::String(bytes, _) => Some(decode_pdf_string(bytes)),
        _ => None,
    }
}

fn winansi_char(byte: u8) -> char {
    match byte {
        0x80 => '\u{20AC}',
        0x82 => '\u{201A}',
        0x83 => '\u{0192}',
        0x84 => '\u{201E}',
        0x85 => '\u{2026}',
        0x86 => '\u{2020}',
        0x87 => '\u{2021}',
        0x88 => '\u{02C6}',
        0x89 => '\u{2030}',
        0x8A => '\u{0160}',
        0x8B => '\u{2039}',
        0x8C => '\u{0152}',
        0x8E => '\u{017D}',
        0x91 => '\u{2018}',
        0x92 => '\u{2019}',
        0x93 => '\u{201C}',
        0x94 => '\u{201D}',
        0x95 => '\u{2022}',
        0x96 => '\u{2013}',
        0x97 => '\u{2014}',
        0x98 => '\u{02DC}',
        0x99 => '\u{2122}',
        0x9A => '\u{0161}',
        0x9B => '\u{203A}',
        0x9C => '\u{0153}',
        0x9E => '\u{017E}',
        0x9F => '\u{0178}',
        other => other as char,
    }
}

fn winansi_byte(ch: char) -> Option<u8> {
    if (ch as u32) <= 0x7F {
        return Some(ch as u8);
    }
    if ('\u{A0}'..='\u{FF}').contains(&ch) {
        return Some(ch as u8);
    }
    Some(match ch {
        '\u{20AC}' => 0x80,
        '\u{201A}' => 0x82,
        '\u{0192}' => 0x83,
        '\u{201E}' => 0x84,
        '\u{2026}' => 0x85,
        '\u{2020}' => 0x86,
        '\u{2021}' => 0x87,
        '\u{02C6}' => 0x88,
        '\u{2030}' => 0x89,
        '\u{0160}' => 0x8A,
        '\u{2039}' => 0x8B,
        '\u{0152}' => 0x8C,
        '\u{017D}' => 0x8E,
        '\u{2018}' => 0x91,
        '\u{2019}' => 0x92,
        '\u{201C}' => 0x93,
        '\u{201D}' => 0x94,
        '\u{2022}' => 0x95,
        '\u{2013}' => 0x96,
        '\u{2014}' => 0x97,
        '\u{02DC}' => 0x98,
        '\u{2122}' => 0x99,
        '\u{0161}' => 0x9A,
        '\u{203A}' => 0x9B,
        '\u{0153}' => 0x9C,
        '\u{017E}' => 0x9E,
        '\u{0178}' => 0x9F,
        _ => return None,
    })
}
