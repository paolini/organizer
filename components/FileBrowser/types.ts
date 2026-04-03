
export type NodeSelection = {
  path: string;
  type: "file" | "directory";
};

export type SelectionMap = Set<string>;
// DEPRECATO: verrà sostituito da Set<NodeSelection>

export type SelectionSet = Set<NodeSelection>;

export type Node = {
  name: string;
  type: "file" | "directory";
};

export type FileInfoData = {
  size: number;
  ext: string;
  tags?: Record<string, unknown>;
};
