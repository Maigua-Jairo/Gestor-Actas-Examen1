export interface EvidenciaCalidad {
  width: number;
  height: number;
  fileSize: number | null;
  laplacianVariance: number;
  luminanceStdDev: number;
  thresholdLaplacian: number;
  resultado: "nueva" | "aceptable" | "probablemente_borrosa";
  advertencia: string | null;
}

export interface ImageQualityRepository {
  analyze(
    base64: string,
    width: number,
    height: number,
    fileSize: number | null,
  ): EvidenciaCalidad;
}

export class AnalizarCalidadEvidenciaUseCase {
  constructor(private readonly repository: ImageQualityRepository) {}

  execute(
    base64: string,
    width: number,
    height: number,
    fileSize: number | null,
  ): EvidenciaCalidad {
    return this.repository.analyze(base64, width, height, fileSize);
  }
}
