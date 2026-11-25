import { JpegImageQualityRepository } from "@/data/image-quality.repository";
import { AnalizarCalidadEvidenciaUseCase } from "@/domain/image-quality.use-cases";

const imageQualityRepository = new JpegImageQualityRepository();

export const imageQualityUseCase =
  new AnalizarCalidadEvidenciaUseCase(imageQualityRepository);
