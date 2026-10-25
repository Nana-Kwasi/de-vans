import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "@/theme/glass";

/** **bold** spans within a line. */
function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={`${key}-${i}`} style={styles.bold}>{part.slice(2, -2)}</Text>
    ) : (
      <Text key={`${key}-${i}`}>{part}</Text>
    )
  );
}

/** Minimal Markdown for policy text: headings, "- " lists, paragraphs and **bold**. */
export function MarkdownText({ source }: { source: string }) {
  const out: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      out.push(<Text key={i} style={h[1].length <= 2 ? styles.h2 : styles.h3}>{inline(h[2], `h${i}`)}</Text>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const start = i;
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(
        <View key={start} style={{ marginTop: 6 }}>
          {items.map((it, j) => (
            <View key={j} style={styles.li}>
              <Text style={styles.p}>•</Text>
              <Text style={[styles.p, { flex: 1 }]}>{inline(it, `li${start}-${j}`)}</Text>
            </View>
          ))}
        </View>
      );
      continue;
    }
    const start = i;
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) para.push(lines[i++]);
    out.push(<Text key={start} style={[styles.p, { marginTop: 8 }]}>{inline(para.join("\n"), `p${start}`)}</Text>);
  }
  return <View>{out}</View>;
}

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: "900", color: colors.textPrimary, marginTop: 16 },
  h3: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginTop: 12 },
  p: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  bold: { fontWeight: "800", color: colors.textPrimary },
  li: { flexDirection: "row", gap: 8, marginTop: 4, paddingRight: 4 },
});
