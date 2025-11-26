import { AnnotationEditorType, AnnotationEditorParamsType, Util } from "../../shared/util.js";
import { InkEditor } from "./ink.js";
import { AnnotationEditor } from "./editor.js";
import { DrawingOptions } from "./draw.js";
import { BoxDrawOutliner } from "./drawers/boxdraw.js";

class CoverInkEditor extends InkEditor {
  static _type = "coverink";
  static _editorType = AnnotationEditorType.COVERINK;
  static _uiManager = null;

  constructor(params) {
    super({ ...params, name: "coverInkEditor" });
    // Don't set defaultL10nId to avoid showing alert messages as text
    // Allow edge resizing in addition to corner resizing
    this._willKeepAspectRatio = false;
  }

  static initialize(l10n, uiManager) {
    super.initialize(l10n, uiManager);
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
    const map = new Map(super.typesMap);
    map.delete(AnnotationEditorParamsType.INK_THICKNESS);
    // Use fill instead of stroke for CoverInk
    map.set(AnnotationEditorParamsType.INK_COLOR, "fill");
    map.set(AnnotationEditorParamsType.INK_OPACITY, "fill-opacity");
    return map;
  }

  static get supportMultipleDrawings() {
    return false;
  }

  static createDrawerInstance(x, y, parentWidth, parentHeight, rotation) {
    return new BoxDrawOutliner(x, y, parentWidth, parentHeight, rotation);
  }

  get propertiesToUpdate() {
    return [
      [AnnotationEditorParamsType.INK_COLOR, this.color],
      [AnnotationEditorParamsType.INK_OPACITY, this.opacity],
    ];
  }

  get color() {
    return this._drawingOptions.fill;
  }

  get opacity() {
    return this._drawingOptions["fill-opacity"];
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
    // Apply background color to the div element
    if (this.div) {
      this.#applyBackground(fillColor, opacity ?? 1);
    }
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
    const {
      _drawingOptions: {
        fill,
        "fill-opacity": opacity,
        "stroke-width": thickness = 1,
      },
    } = this;
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
