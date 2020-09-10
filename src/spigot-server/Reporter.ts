import { PublishDiagnosticsParams } from "vscode-languageserver";
export interface Reporter {
  sendDiagnostics(params: PublishDiagnosticsParams): void;
}
