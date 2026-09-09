import { mkdir, writeFile } from "node:fs/promises";
import {
  aggregateMarkdown,
  aggregateReports,
  type HarnessReport,
  reportMarkdown,
  reportsJson,
} from "@e308/core/testing";

export interface ExtraReportFile {
  readonly name: string;
  readonly contents: string;
}

export async function writeReportSet(options: {
  readonly output: URL;
  readonly reports: readonly HarnessReport[];
  readonly fileName: (report: HarnessReport) => string;
  readonly extras?: readonly ExtraReportFile[];
}): Promise<void> {
  await mkdir(options.output, { recursive: true });
  await Promise.all([
    writeFile(new URL("reports.json", options.output), reportsJson(options.reports)),
    writeFile(
      new URL("aggregate.md", options.output),
      aggregateMarkdown(aggregateReports(options.reports)),
    ),
    ...options.reports.map((report) =>
      writeFile(new URL(options.fileName(report), options.output), reportMarkdown(report)),
    ),
    ...(options.extras ?? []).map((extra) =>
      writeFile(new URL(extra.name, options.output), extra.contents),
    ),
  ]);
}
