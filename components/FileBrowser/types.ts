export type NodeType = "file" | "directory";

export type Node = {
  name: string;
  type: NodeType;
};

/** Elemento della cartella corrente con il path relativo completo */
export type Entry = Node & { path: string };

/** Mappa path cartella -> figli (null = non ancora caricata) */
export type FileTree = Record<string, Node[] | null>;

export type CommonTags = {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: number | null;
  track: { no: number | null; of: number | null } | null;
  genre: string[] | null;
};

export type Picture = {
  mime: string;
  description: string | null;
  size: number;
  data: string | null;
};

export type FileInfoData = {
  size: number;
  ext: string;
  tags?: {
    common?: CommonTags;
    pictures?: Picture[];
    format?: { container: string | null; codec: string | null; sampleRate: number | null };
    error?: string;
  } | null;
};

export function joinPath(dir: string, name: string) {
  return dir ? `${dir}/${name}` : name;
}

export function parentOf(path: string) {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function baseName(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Restituisce tutti gli antenati di un path (incluso "" e il path stesso) */
export function ancestorsOf(path: string): string[] {
  const out = [""];
  if (!path) return out;
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}
