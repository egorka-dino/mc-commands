import * as THREE from "three";
import { TEXTURE_NAMES, TEXTURE_VERSION } from "./scene-geometry";

/** One owner per viewer, including in-flight loads that finish after unmount. */
export function createTextureMaterials(reportFailure: (names: string[]) => void) {
  let disposed = false;
  const failed = new Set<string>();
  const textures = new Set<THREE.Texture>();
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const loader = new THREE.TextureLoader();
  // A visible checker identifies unsupported blocks and failed requests.
  const missing = new THREE.DataTexture(new Uint8Array([
    200, 40, 200, 255, 35, 35, 35, 255,
    35, 35, 35, 255, 200, 40, 200, 255,
  ]), 2, 2);
  const configure = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    textures.add(texture);
    return texture;
  };
  configure(missing);
  const fallback = new THREE.MeshLambertMaterial({map:missing});
  for (const name of TEXTURE_NAMES) {
    const material = new THREE.MeshLambertMaterial({map:missing});
    materials.set(name, material);
    const texture = loader.load(`/structure-textures/${TEXTURE_VERSION}/${name}.png`, loaded => {
      if (disposed) { loaded.dispose(); return; }
      configure(loaded);
      material.map = loaded;
      material.needsUpdate = true;
    }, undefined, () => {
      if (disposed) return;
      failed.add(name); reportFailure([...failed]);
    });
    // Track immediately, even if the request fails or cleanup precedes onLoad.
    textures.add(texture);
  }
  return {
    materials, fallback,
    dispose() {
      disposed = true;
      for (const material of materials.values()) material.dispose();
      fallback.dispose();
      for (const texture of textures) texture.dispose();
      textures.clear();
    },
  };
}
