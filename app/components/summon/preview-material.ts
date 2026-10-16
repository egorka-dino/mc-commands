import * as THREE from "three";

export type CapturedMaterialOptions = {
  map: THREE.Texture | null;
  color?: string;
  translucent: boolean;
  overlayOrder?: number;
  blendOverlay?: boolean;
};

/** Pattern PNGs have fractional alpha, including gradients and logo edges. */
export function createPreviewMaterial(options: CapturedMaterialOptions) {
  return new THREE.MeshBasicMaterial({
    map: options.map, color: options.color || "#ffffff", vertexColors: true,
    side: THREE.DoubleSide, alphaTest: 0.01,
    transparent: !!options.blendOverlay || options.translucent,
    // The opaque item supplies depth; decorative layers must not hide each other.
    depthWrite: !options.blendOverlay,
    forceSinglePass: !!options.blendOverlay,
    polygonOffset: !!options.overlayOrder,
    polygonOffsetFactor: options.overlayOrder ? -1 : 0,
    polygonOffsetUnits: options.overlayOrder ? -1 : 0,
  });
}
