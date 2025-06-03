import * as fs from 'fs';
interface RGBColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}
interface Fill {
  type: string;
  color: RGBColor;
}
interface Stroke {
  color: RGBColor;
}
interface Effect {
  type: string;
  color: RGBColor;
  offset: { x: number; y: number };
  radius: number;
}
interface Style {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
}
interface ComponentProperty {
  value: string;
}
interface FigmaNode {
  id: string;
  name: string;
  type: string;
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  cornerRadius?: number;
  opacity?: number;
  blendMode?: string;
  visible?: boolean;
  fills?: Fill[];
  strokes?: Stroke[];
  strokeWeight?: number;
  effects?: Effect[];
  children?: FigmaNode[];
  style?: Style;
  characters?: string;
  absoluteBoundingBox?: { width: number; height: number };
  componentProperties?: Record<string, ComponentProperty>;
}
interface FigmaJson {
  Result: {
    nodes: Record<string, { document: FigmaNode }>;
  };
}
interface NoCodeBlock {
  component: any;
  visibility: { value: boolean };
  displayName: string;
  id: string;
  parentId?: string;
  additional?: { isRootBlock: boolean };
}
interface NoCodeJson {
  blocks: Record<string, NoCodeBlock>;
  layout: {
    footer: string;
    header: string;
    body: string;
  };
  interfaceType: string;
  componentType: string;
  name: string;
  slug: string;
}
export function convertFigmaToNoCode(figmaJson: FigmaJson): NoCodeJson {
  const noCodeJson: NoCodeJson = {
    blocks: {},
    layout: {
      footer: "footer_id",
      header: "header_id",
      body: "root_id"
    },
    interfaceType: "application",
    componentType: "PAGE",
    name: "Converted from Figma",
    slug: "figma-conversion"
  };
  Object.entries(figmaJson.Result.nodes).forEach(([_, nodeData]) => {
    const node = nodeData.document;
    if (!detectButtonGroup(node)) return;
    const buttonGroupId = `b_${generateId()}`;
    noCodeJson.blocks[buttonGroupId] = {
      component: {
        componentType: 'ButtonGroup',
        appearance: mapButtonGroupAppearance(node),
        content: mapButtonGroupContent(node)
      },
      visibility: { value: true },
      displayName: node.name,
      id: buttonGroupId,
      parentId: "root_id"
    };
  });
  if (!noCodeJson.blocks.root_id) {
    noCodeJson.blocks.root_id = {
      component: {
        componentType: "Stack",
        appearance: {
          alignItems: "stretch",
          direction: "column",
          justifyContent: "flex-start",
          styles: {
            padding: { all: "p-xl" },
            backgroundColor: "bg-workspace",
            gap: { all: "gap-md" },
            width: "w-full",
            height: "h-full"
          }
        },
        content: {
          blockIds: Object.keys(noCodeJson.blocks).filter(id => id !== 'root_id')
        }
      },
      visibility: { value: true },
      displayName: "Body",
      additional: { isRootBlock: true },
      id: "root_id"
    };
  }
  return noCodeJson;
}
function detectButtonGroup(node: FigmaNode): boolean {
  const nameMatches = ['button group', 'buttons', 'btn-group', 'buttongroup'].some(keyword =>
    node.name.toLowerCase().includes(keyword)
  );
  const hasMultipleButtons = (node.children || []).filter(child =>
    child.type === 'INSTANCE' &&
    (child.name.toLowerCase().includes('button'))
  ).length >= 2;
  const isHorizontalLayout = node.layoutMode === 'HORIZONTAL';
  return nameMatches || (hasMultipleButtons && isHorizontalLayout);
}
function mapButtonGroupAppearance(node: FigmaNode): any {
  return {
    layoutDirection: node.layoutMode || 'HORIZONTAL',
    spacing: node.itemSpacing || 8,
    padding: getPadding(node),
    backgroundColor: getBackgroundColor(node),
    border: getBorderProperties(node),
    borderRadius: node.cornerRadius || 0,
    shadow: getShadows(node),
    opacity: node.opacity || 1,
    blendMode: node.blendMode || 'NORMAL'
  };
}
function mapButtonGroupContent(node: FigmaNode): any {
  const buttons = (node.children || []).filter(child => child.type === "INSTANCE" && child.visible !== false);
  return {
    mode: "manual",
    options: {
      data: buttons.map((btn, i) => extractButtonProperties(btn, i + 1))
    },
    type: "default"
  };
}
function extractButtonProperties(btnNode: FigmaNode, index: number): any {
  return {
    id: `button${index}`,
    label: getButtonText(btnNode),
    icon: getButtonIcon(btnNode),
    iconSize: getIconSize(btnNode),
    backgroundColor: getBackgroundColor(btnNode),
    border: getBorderProperties(btnNode),
    borderRadius: btnNode.cornerRadius || 0,
    padding: getPadding(btnNode),
    font: getFontProperties(btnNode),
    states: getButtonStates(btnNode),
    opacity: btnNode.opacity || 1
  };
}
function getPadding(node: FigmaNode): any {
  return {
    left: node.paddingLeft || 8,
    right: node.paddingRight || 8,
    top: node.paddingTop || 4,
    bottom: node.paddingBottom || 4
  };
}
function getBackgroundColor(node: FigmaNode): string | null {
  const fill = node.fills?.find(f => f.type === 'SOLID');
  return fill ? rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.color.a) : null;
}
function getBorderProperties(node: FigmaNode): any {
  const stroke = node.strokes?.[0];
  return {
    width: node.strokeWeight || 0,
    color: stroke
      ? rgbaToHex(stroke.color.r, stroke.color.g, stroke.color.b, stroke.color.a)
      : null
  };
}
function getShadows(node: FigmaNode): any[] {
  return (node.effects || [])
    .filter(effect => effect.type === 'DROP_SHADOW')
    .map(effect => ({
      color: rgbaToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
      offsetX: effect.offset.x,
      offsetY: effect.offset.y,
      blur: effect.radius
    }));
}
function getFontProperties(node: FigmaNode): any {
  const textChild = (node.children || []).find(child => child.type === 'TEXT');
  if (!textChild) return {};
  return {
    fontFamily: textChild.style?.fontFamily || 'Arial',
    fontWeight: textChild.style?.fontWeight || 400,
    fontSize: textChild.style?.fontSize || 14,
    textColor: getBackgroundColor(textChild)
  };
}
function getButtonStates(node: FigmaNode): any[] {
  if (!node.componentProperties) return [];
  return Object.keys(node.componentProperties).map(prop => ({
    state: prop,
    value: node.componentProperties![prop].value
  }));
}
function getButtonText(node: FigmaNode): string {
  const textNode = (node.children || []).find(child => child.type === 'TEXT');
  return textNode?.characters || "Button";
}
function getButtonIcon(node: FigmaNode): string | null {
  const iconNode = (node.children || []).find(child => child.type === 'VECTOR' || child.type === 'FRAME');
  return iconNode?.name || null;
}
function getIconSize(node: FigmaNode): { width: number; height: number } | null {
  const iconNode = (node.children || []).find(child => child.type === 'VECTOR' || child.type === 'FRAME');
  return iconNode?.absoluteBoundingBox
    ? { width: iconNode.absoluteBoundingBox.width, height: iconNode.absoluteBoundingBox.height }
    : null;
}
function rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);
  return a < 1
    ? `rgba(${r255},${g255},${b255},${a})`
    : `#${((1 << 24) + (r255 << 16) + (g255 << 8) + b255).toString(16).slice(1)}`;
}
function generateId(): string {
  return Math.random().toString(36).substring(2, 8);
}
// CLI execution
if (require.main === module) {
  const [, , figmaJsonPath, outputPath = './no-code-output.json'] = process.argv;
  if (!figmaJsonPath) {
    console.error('Usage: ts-node figma-to-nocode-converter.ts <figma-json-file> [output-file]');
    process.exit(1);
  }
  try {
    const figmaJson: FigmaJson = JSON.parse(fs.readFileSync(figmaJsonPath, 'utf8'));
    const noCodeJson = convertFigmaToNoCode(figmaJson);
    fs.writeFileSync(outputPath, JSON.stringify(noCodeJson, null, 2));
    console.log(`:white_check_mark: Successfully converted Button Groups to ${outputPath}`);
  } catch (err) {
    console.error(':x: Conversion failed:', err);
  }
}

