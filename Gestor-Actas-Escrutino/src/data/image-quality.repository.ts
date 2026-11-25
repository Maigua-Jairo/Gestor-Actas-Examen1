import { decode } from "jpeg-js";

import type {
  EvidenciaCalidad,
  ImageQualityRepository,
} from "@/domain/image-quality.use-cases";

export const BLUR_LAPLACIAN_THRESHOLD = 100;

function decodeBase64(base64: string): Uint8Array {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error("El dispositivo no puede decodificar la fotografía.");
}

export class JpegImageQualityRepository implements ImageQualityRepository {
  analyze(
    base64: string,
    width: number,
    height: number,
    fileSize: number | null,
  ): EvidenciaCalidad {
    const jpeg = decode(decodeBase64(base64), {
      useTArray: true,
      formatAsRGBA: true,
      tolerantDecoding: true,
      maxResolutionInMP: 100,
      maxMemoryUsageInMB: 512,
    });

    const luminances: number[] = [];
    const sampleStep = 4;

    for (let y = 0; y < jpeg.height; y += sampleStep) {
      for (let x = 0; x < jpeg.width; x += sampleStep) {
        const offset = (y * jpeg.width + x) * 4;
        luminances.push(
          0.299 * jpeg.data[offset] +
            0.587 * jpeg.data[offset + 1] +
            0.114 * jpeg.data[offset + 2],
        );
      }
    }

    let luminanceMean = 0;
    for (const luminance of luminances) {
      luminanceMean += luminance;
    }
    luminanceMean /= luminances.length || 1;

    let luminanceVariance = 0;
    for (const luminance of luminances) {
      luminanceVariance += (luminance - luminanceMean) ** 2;
    }
    luminanceVariance /= luminances.length || 1;
    const luminanceStdDev = Math.sqrt(luminanceVariance);

    let laplacianSum = 0;
    let laplacianVarianceSum = 0;
    let laplacianSamples = 0;

    const luminanceAt = (x: number, y: number): number => {
      const offset =
        (Math.min(jpeg.height - 1, Math.max(0, y)) * jpeg.width +
          Math.min(jpeg.width - 1, Math.max(0, x))) *
        4;
      return (
        0.299 * jpeg.data[offset] +
        0.587 * jpeg.data[offset + 1] +
        0.114 * jpeg.data[offset + 2]
      );
    };

    for (let y = sampleStep; y < jpeg.height - sampleStep; y += sampleStep) {
      for (
        let x = sampleStep;
        x < jpeg.width - sampleStep;
        x += sampleStep
      ) {
        const laplacian =
          4 * luminanceAt(x, y) -
          luminanceAt(x - sampleStep, y) -
          luminanceAt(x + sampleStep, y) -
          luminanceAt(x, y - sampleStep) -
          luminanceAt(x, y + sampleStep);
        laplacianSum += laplacian;
        laplacianVarianceSum += laplacian * laplacian;
        laplacianSamples += 1;
      }
    }

    const laplacianMean =
      laplacianSamples > 0 ? laplacianSum / laplacianSamples : 0;
    const laplacianVariance =
      laplacianSamples > 0
        ? laplacianVarianceSum / laplacianSamples - laplacianMean ** 2
        : 0;
    const probablyBlurry =
      laplacianVariance < BLUR_LAPLACIAN_THRESHOLD ||
      luminanceStdDev < 18 ||
      width < 1200 ||
      height < 1200;

    const result: EvidenciaCalidad = {
      width,
      height,
      fileSize,
      laplacianVariance: Number(laplacianVariance.toFixed(2)),
      luminanceStdDev: Number(luminanceStdDev.toFixed(2)),
      thresholdLaplacian: BLUR_LAPLACIAN_THRESHOLD,
      resultado: probablyBlurry ? "probablemente_borrosa" : "aceptable",
      advertencia: probablyBlurry
        ? "La fotografía podría estar borrosa o tener poca iluminación. Procura tomarla nuevamente con enfoque y buena luz."
        : null,
    };

    return result;
  }
}
