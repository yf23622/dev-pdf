import { AnnotationEditorType, AnnotationEditorParamsType, Util, shadow } from "../../shared/util.js";
import { DrawingEditor, DrawingOptions } from "./draw.js";
import { AnnotationEditor } from "./editor.js";
import { BoxDrawOutliner } from "./drawers/boxdraw.js";
import { BoxDrawOutline } from "./drawers/boxdraw.js";
import { BasicColorPicker } from "./color_picker.js";

class CoverInkEditor extends DrawingEditor {
  static _type = "coverink";
  static _editorType = AnnotationEditorType.COVERINK;
  static _defaultDrawingOptions = null;
  static _uiManager = null;

  constructor(params) {
    super({ ...params, name: "coverInkEditor" });
    // Allow edge resizing in addition to corner resizing
    this._willKeepAspectRatio = false;
  }

  static initialize(l10n, uiManager) {
    AnnotationEditor.initialize(l10n, uiManager);
    this._uiManager = uiManager;
    this._defaultDrawingOptions = new CoverInkDrawingOptions();
  }

  static getDefaultDrawingOptions(options) {
    const clone = this._defaultDrawingOptions.clone();
    // Always get current color and opacity from UI
    const currentColor = this._uiManager?.currentDrawingColor || "#000000";
    const currentOpacity = this._uiManager?.currentDrawingOpacity ?? 1;
    const fillColor = typeof currentColor === "string" ? currentColor : Util.makeHexColor(...currentColor);
    clone.updateProperties({
      fill: fillColor,
      "fill-opacity": currentOpacity,
      stroke: fillColor,
      "stroke-opacity": currentOpacity,
      "stroke-width": 1,
    });
    if (options) {
      clone.updateProperties(options);
    }
    return clone;
  }

  static get typesMap() {
    return shadow(
      this,
      "typesMap",
      new Map([
        [AnnotationEditorParamsType.INK_COLOR, "fill"],
        [AnnotationEditorParamsType.INK_OPACITY, "fill-opacity"],
      ])
    );
  }

  static get supportMultipleDrawings() {
    return false;
  }

  static createDrawerInstance(x, y, parentWidth, parentHeight, rotation) {
    return new BoxDrawOutliner(x, y, parentWidth, parentHeight, rotation);
  }

  static get defaultPropertiesToUpdate() {
    const properties = [];
    const options = this._defaultDrawingOptions;
    for (const [type, name] of this.typesMap) {
      properties.push([type, options[name]]);
    }
    return properties;
  }

  get propertiesToUpdate() {
    return [
      [AnnotationEditorParamsType.INK_COLOR, this.color],
      [AnnotationEditorParamsType.INK_OPACITY, this.opacity],
    ];
  }

  get colorType() {
    return AnnotationEditorParamsType.INK_COLOR;
  }

  get color() {
    return this._drawingOptions.fill;
  }

  get opacity() {
    return this._drawingOptions["fill-opacity"];
  }

  get toolbarButtons() {
    this._colorPicker ||= new BasicColorPicker(this);
    return [["colorPicker", this._colorPicker]];
  }

  createDrawingOptions({ color, opacity }) {
    // Use fill color with opacity, no stroke.
    const fillColor = Util.makeHexColor(...color);
    this._drawingOptions = this.constructor.getDefaultDrawingOptions({
      fill: fillColor,
      "fill-opacity": opacity,
      stroke: fillColor,
      "stroke-opacity": opacity,
      "stroke-width": 1,
    });
    // Apply background color to the div element immediately after div is rendered
    if (this.div) {
      this.#applyBackground(fillColor, opacity ?? 1);
    }
  }

  render() {
    const div = super.render();
    // Ensure background color is applied after div is rendered
    if (this._drawingOptions) {
      const fillColor = this._drawingOptions.fill || "#000000";
      const opacity = this._drawingOptions["fill-opacity"] || 1;
      this.#applyBackground(fillColor, opacity);
    }
    return div;
  }

  updateParams(type, value) {
    // Don't call super.updateParams for CoverInk as we handle properties differently
    // CoverInk uses fill/fill-opacity instead of stroke/stroke-opacity
    
    if (type === AnnotationEditorParamsType.INK_COLOR) {
      if (this.div) {
        const hex = typeof value === "string" ? value : Util.makeHexColor(...value);
        const [r, g, b] = (hex.match(/[0-9a-f]{2}/gi) || ["00","00","00"]).map(h=>parseInt(h,16));
        const toHex = vals => `#${vals.map(v=>v.toString(16).padStart(2,"0")).join("")}`;
        const lighten = f => toHex([r,g,b].map(v=>Math.min(255, Math.round(v + (255 - v) * f))));
        const darken = f => toHex([r,g,b].map(v=>Math.max(0, Math.round(v * (1 - f)))));
        const outline = darken(0.2);
        const around = lighten(0.85);
        this.div.style.setProperty("--outline-color", outline);
        this.div.style.setProperty("--hover-outline-color", outline);
        this.div.style.setProperty("--outline-around-color", around);
        this.div.style.setProperty("--hover-outline-around-color", around);
        this.div.style.setProperty("--resizer-bg-color", outline);
        this.#applyBackground(hex, this._drawingOptions["fill-opacity"] ?? 1);
        // Sync fill color and stroke for live drawing
        this._drawingOptions.updateProperty("fill", hex);
        this._drawingOptions.updateProperty("stroke", hex);
        this.parent?.drawLayer.updateProperties(this._drawId, this._drawingOptions.toSVGProperties());
      }
    }
    if (type === AnnotationEditorParamsType.INK_OPACITY) {
      if (this.div) {
        const hex = this._drawingOptions.fill || "#000000";
        this.#applyBackground(hex, value ?? 1);
        this._drawingOptions.updateProperty("fill-opacity", value ?? 1);
        this._drawingOptions.updateProperty("stroke-opacity", value ?? 1);
        this.parent?.drawLayer.updateProperties(this._drawId, this._drawingOptions.toSVGProperties());
      }
    }
  }

  #applyBackground(hex, opacity) {
    const m = hex.match(/[0-9a-f]{2}/gi);
    if (!m || !this.div) return;
    const [r,g,b] = m.map(h=>parseInt(h,16));
    this.div.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  serialize(isForCopying = false) {
    if (this.isEmpty()) {
      return null;
    }
    if (this.deleted) {
      return this.serializeDeleted();
    }
    const { lines, points, rect } = this.serializeDraw(isForCopying);
    
    // Ensure fill color exists; if not, use the current drawing color
    let fill = this._drawingOptions?.fill || this.color || "#000000";
    if (!fill.startsWith("#")) {
      fill = Util.makeHexColor(...fill);
    }
    
    const opacity = this._drawingOptions?.["fill-opacity"] ?? this.opacity ?? 1;
    const thickness = this._drawingOptions?.["stroke-width"] ?? 1;
    
    const serialized = Object.assign(super.serialize(isForCopying), {
      // Persist as Ink annotation for compatibility
      annotationType: AnnotationEditorType.INK,
      color: AnnotationEditor._colorManager.convert(fill),
      opacity,
      thickness,
      paths: {
        lines,
        points,
      },
      rect,
    });
    this.addComment(serialized);
    if (isForCopying) {
      serialized.isCopy = true;
      return serialized;
    }
    if (this.annotationElementId && !this.hasBeenModified) {
      return null;
    }
    serialized.id = this.annotationElementId;
    return serialized;
  }

  static deserializeDraw(
    pageX,
    pageY,
    pageWidth,
    pageHeight,
    innerMargin,
    data
  ) {
    return BoxDrawOutline.deserialize(
      pageX,
      pageY,
      pageWidth,
      pageHeight,
      innerMargin,
      data
    );
  }

  static async deserialize(data, parent, uiManager) {
    // CoverInk annotations are saved as INK type, so we need to handle that
    const editor = await super.deserialize(data, parent, uiManager);
    if (editor) {
      // Ensure the draw options are properly initialized with the current colors
      editor.createDrawingOptions({
        color: AnnotationEditor._colorManager.convert(data.color || [0, 0, 0]),
        opacity: data.opacity || 1,
      });
    }
    return editor;
  }
}

class CoverInkDrawingOptions extends DrawingOptions {
  constructor() {
    super();
    super.updateProperties({
      fill: "#000000",
      "fill-opacity": 1,
      stroke: "#000000",
      "stroke-opacity": 1,
      "stroke-width": 1,
    });
  }

  clone() {
    const clone = new CoverInkDrawingOptions();
    clone.updateAll(this);
    return clone;
  }
}

export { CoverInkEditor };
