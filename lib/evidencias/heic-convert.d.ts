// heic-convert no publica tipos. Solo se declara la firma que se usa.
declare module "heic-convert" {
  function convert(opciones: {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  }): Promise<ArrayBuffer | Uint8Array>;
  export default convert;
}
