use pdfforge::pdf::{
    add_text, analyze, delete_pages, delete_run, duplicate_page, hello_pdf, load_pdf,
    merge_documents, reorder_pages, replace_run, rotate_pages, save_pdf, scanned_pdf, search_runs,
    simple_text_pdf, split_document, two_page_pdf, AddText, PageRotation,
};

#[test]
fn analyze_extracts_hello_world_from_tj() {
    let bytes = hello_pdf("Hello World").expect("sample pdf");
    let document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    assert_eq!(analysis.pages.len(), 1);
    assert_eq!(analysis.runs.len(), 1);
    assert_eq!(analysis.runs[0].text, "Hello World");
    assert_eq!(analysis.runs[0].style.font_name, "Helvetica");
    assert!(analysis.runs[0]
        .source_operators
        .contains(&"Tj".to_string()));
}

#[test]
fn analyze_extracts_tj_kerning_array() {
    let bytes = simple_text_pdf("Hello World", "TJ").expect("sample pdf");
    let document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    assert_eq!(analysis.runs[0].text, "Hello World");
    assert!(analysis.runs[0]
        .source_operators
        .contains(&"TJ".to_string()));
}

#[test]
fn replace_rewrites_text_and_reopens() {
    let bytes = hello_pdf("Hello World").expect("sample pdf");
    let mut document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    let run_id = analysis.runs[0].id.clone();
    let result = replace_run(&mut document, &run_id, "Hello PDFForge").expect("replace");
    assert!(!result.font_fallback);

    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let again = analyze(&reopened, 2).expect("analyze reopened");
    assert_eq!(again.runs[0].text, "Hello PDFForge");
    let content = String::from_utf8_lossy(&saved);
    assert!(
        !content.contains("\nre\n") && !content.contains(" re "),
        "text replace must not paint a covering rectangle"
    );
}

#[test]
fn replace_split_tj_rebuilds_run() {
    let bytes = simple_text_pdf("HelloWorld", "split").expect("sample pdf");
    let mut document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    assert_eq!(analysis.runs[0].text.replace(' ', ""), "HelloWorld");
    let run_id = analysis.runs[0].id.clone();
    replace_run(&mut document, &run_id, "Replaced").expect("replace");
    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let again = analyze(&reopened, 2).expect("analyze");
    assert!(again.runs.iter().any(|run| run.text.contains("Replaced")));
}

#[test]
fn delete_run_removes_text() {
    let bytes = hello_pdf("Delete me").expect("sample pdf");
    let mut document = load_pdf(&bytes).expect("load");
    let run_id = analyze(&document, 1).expect("analyze").runs[0].id.clone();
    delete_run(&mut document, &run_id).expect("delete");
    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    assert!(analyze(&reopened, 2).expect("analyze").runs.is_empty());
}

#[test]
fn scanned_pdf_analyzes_without_crash() {
    let bytes = scanned_pdf().expect("scanned");
    let document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    assert_eq!(analysis.pages.len(), 1);
    assert!(analysis.runs.is_empty());
}

#[test]
fn two_page_pdf_lists_both_pages() {
    let bytes = two_page_pdf().expect("two page");
    let document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    assert_eq!(analysis.pages.len(), 2);
    let texts: Vec<_> = analysis.runs.iter().map(|run| run.text.as_str()).collect();
    assert!(texts.contains(&"Page One"));
    assert!(texts.contains(&"Page Two"));
}

#[test]
fn malformed_bytes_are_rejected() {
    let error = load_pdf(b"not a pdf").expect_err("must fail");
    assert!(error.to_string().contains("not a PDF"));
}

#[test]
fn add_text_uses_baseline_origin() {
    let bytes = hello_pdf("Original").expect("sample pdf");
    let mut document = load_pdf(&bytes).expect("load");
    add_text(
        &mut document,
        &AddText {
            page: 1,
            text: "Added".to_string(),
            x: 72.0,
            y: 680.0,
            size: 12.0,
            color: "#000000".into(),
        },
    )
    .expect("add");
    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let texts: Vec<_> = analyze(&reopened, 2)
        .expect("analyze")
        .runs
        .into_iter()
        .map(|run| run.text)
        .collect();
    assert!(texts.iter().any(|text| text == "Original"));
    assert!(texts.iter().any(|text| text == "Added"));
}

#[test]
fn search_finds_matching_runs() {
    let bytes = hello_pdf("Invoice 123").expect("sample pdf");
    let document = load_pdf(&bytes).expect("load");
    let analysis = analyze(&document, 1).expect("analyze");
    let hits = search_runs(&analysis, "invoice");
    assert_eq!(hits.len(), 1);
}

#[test]
fn reorder_and_rotate_pages_reopen() {
    let bytes = two_page_pdf().expect("two page");
    let mut document = load_pdf(&bytes).expect("load");
    reorder_pages(&mut document, &[2, 1]).expect("reorder");
    rotate_pages(
        &mut document,
        &[PageRotation {
            page: 1,
            degrees: 90,
        }],
    )
    .expect("rotate");
    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let analysis = analyze(&reopened, 2).expect("analyze");
    assert_eq!(analysis.pages.len(), 2);
    assert_eq!(analysis.pages[0].rotation, 90);
    assert_eq!(analysis.runs[0].text, "Page Two");
}

#[test]
fn delete_pages_and_split_reopen() {
    let bytes = two_page_pdf().expect("two page");
    let document = load_pdf(&bytes).expect("load");
    let split = split_document(&document, &[2]).expect("split");
    let split_doc = load_pdf(&split).expect("load split");
    let split_analysis = analyze(&split_doc, 1).expect("analyze split");
    assert_eq!(split_analysis.pages.len(), 1);
    assert_eq!(split_analysis.runs[0].text, "Page Two");

    let mut remaining = load_pdf(&bytes).expect("load");
    delete_pages(&mut remaining, &[1]).expect("delete page");
    let saved = save_pdf(&mut remaining).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let analysis = analyze(&reopened, 2).expect("analyze");
    assert_eq!(analysis.pages.len(), 1);
    assert_eq!(analysis.runs[0].text, "Page Two");
}

#[test]
fn duplicate_page_inserts_copy_after_source() {
    let bytes = two_page_pdf().expect("two page");
    let mut document = load_pdf(&bytes).expect("load");
    duplicate_page(&mut document, 1).expect("duplicate");
    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let analysis = analyze(&reopened, 2).expect("analyze");
    assert_eq!(analysis.pages.len(), 3);
    let texts: Vec<_> = analysis.runs.iter().map(|run| run.text.as_str()).collect();
    assert_eq!(texts, vec!["Page One", "Page One", "Page Two"]);
}

#[test]
fn merge_documents_reopen() {
    let first = hello_pdf("First").expect("first");
    let second = hello_pdf("Second").expect("second");
    let mut document = load_pdf(&first).expect("load");
    merge_documents(&mut document, &second).expect("merge");
    let saved = save_pdf(&mut document).expect("save");
    let reopened = load_pdf(&saved).expect("reopen");
    let analysis = analyze(&reopened, 2).expect("analyze");
    assert_eq!(analysis.pages.len(), 2);
    let texts: Vec<_> = analysis.runs.iter().map(|run| run.text.as_str()).collect();
    assert!(texts.contains(&"First"));
    assert!(texts.contains(&"Second"));
}

#[test]
fn unencodable_replace_reports_font_fallback() {
    let bytes = hello_pdf("Hello").expect("sample pdf");
    let mut document = load_pdf(&bytes).expect("load");
    let run_id = analyze(&document, 1).expect("analyze").runs[0].id.clone();
    let result = replace_run(&mut document, &run_id, "你好").expect("replace");
    assert!(result.font_fallback);
}
