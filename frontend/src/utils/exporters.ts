export interface ExportSegment {
  start: number;
  end: number;
  text: string;
  translation?: string;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatSrtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, '0')}`;
}

export function exportJSON(segments: ExportSegment[], srcLang: string, tgtLang: string): string {
  return JSON.stringify({ source_lang: srcLang, target_lang: tgtLang, segments }, null, 2);
}

export function exportCSV(segments: ExportSegment[]): string {
  const header = 'start,end,text,translation';
  const rows = segments.map(
    (s) => `${s.start},${s.end},"${s.text.replace(/"/g, '""')}","${(s.translation || '').replace(/"/g, '""')}"`
  );
  return [header, ...rows].join('\n');
}

export function exportSRT(segments: ExportSegment[], useTranslation = false): string {
  return segments
    .map((s, i) => {
      const text = useTranslation && s.translation ? s.translation : s.text;
      return `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${text}\n`;
    })
    .join('\n');
}

export function exportPlainText(segments: ExportSegment[], includeTranslation = true): string {
  return segments
    .map((s) => {
      let line = s.text;
      if (includeTranslation && s.translation) line += `\n→ ${s.translation}`;
      return line;
    })
    .join('\n\n');
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportELAN(segments: ExportSegment[], srcLang = 'Transcription', tgtLang = 'Translation'): string {
  const ts: string[] = [];
  const transAnns: string[] = [];
  const srcAnns: string[] = [];

  segments.forEach((s, i) => {
    const tsIdx = i * 2;
    const startMs = Math.round(s.start * 1000);
    const endMs = Math.round(s.end * 1000);
    ts.push(`        <TIME_SLOT TIME_SLOT_ID="ts${tsIdx + 1}" TIME_VALUE="${startMs}"/>`);
    ts.push(`        <TIME_SLOT TIME_SLOT_ID="ts${tsIdx + 2}" TIME_VALUE="${endMs}"/>`);
    srcAnns.push(
      `        <ANNOTATION>\n` +
      `            <ALIGNABLE_ANNOTATION ANNOTATION_ID="a${i + 1}" TIME_SLOT_REF1="ts${tsIdx + 1}" TIME_SLOT_REF2="ts${tsIdx + 2}">\n` +
      `                <ANNOTATION_VALUE>${escapeXml(s.text)}</ANNOTATION_VALUE>\n` +
      `            </ALIGNABLE_ANNOTATION>\n` +
      `        </ANNOTATION>`
    );
    if (s.translation) {
      transAnns.push(
        `        <ANNOTATION>\n` +
        `            <ALIGNABLE_ANNOTATION ANNOTATION_ID="a${1000 + i + 1}" TIME_SLOT_REF1="ts${tsIdx + 1}" TIME_SLOT_REF2="ts${tsIdx + 2}">\n` +
        `                <ANNOTATION_VALUE>${escapeXml(s.translation)}</ANNOTATION_VALUE>\n` +
        `            </ALIGNABLE_ANNOTATION>\n` +
        `        </ANNOTATION>`
      );
    }
  });

  const date = new Date().toISOString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ANNOTATION_DOCUMENT AUTHOR="Bridgelingua" DATE="${date}" FORMAT="3.0" VERSION="3.0"\n`;
  xml += `    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `    xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">\n`;
  xml += `    <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds"/>\n`;
  xml += `    <TIME_ORDER>\n${ts.join('\n')}\n    </TIME_ORDER>\n`;
  xml += `    <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="${escapeXml(srcLang)}">\n${srcAnns.join('\n')}\n    </TIER>\n`;
  if (transAnns.length > 0) {
    xml += `    <TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="${escapeXml(tgtLang)}">\n${transAnns.join('\n')}\n    </TIER>\n`;
  }
  xml += `    <LINGUISTIC_TYPE LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>\n`;
  xml += `</ANNOTATION_DOCUMENT>\n`;
  return xml;
}

export function download(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
