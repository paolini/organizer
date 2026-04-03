export type SelectionMap = Set<string>;

export type Node = {
  name: string;
  type: "file" | "directory";
};

export type FileInfoData = {
  size: number;
  ext: string;
  tags?: Record<string, unknown>;
};
