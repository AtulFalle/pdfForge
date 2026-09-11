export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextStyle {
  font_name: string;
  size: number;
  color: string;
}

export interface TextRun {
  id: string;
  page: number;
  text: string;
  bbox: BBox;
  style: TextStyle;
  transform: number[];
  source_operators: string[];
  font_fallback: boolean;
}

export interface PageInfo {
  number: number;
  width: number;
  height: number;
  rotation: number;
}

export interface DocumentAnalysis {
  revision: number;
  pages: PageInfo[];
  runs: TextRun[];
}

export interface MutationResponse {
  sessionId: string;
  revision: number;
  analysis: DocumentAnalysis;
  fileUrl: string;
  fontFallback?: boolean;
}

export interface AddTextRequest {
  page: number;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface PendingAdd {
  page: number;
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
}

export interface PageRotation {
  page: number;
  degrees: number;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}

export type EditorTool = 'select' | 'add-text';

export interface ViewportSize {
  width: number;
  height: number;
}