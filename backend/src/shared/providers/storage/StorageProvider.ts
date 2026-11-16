/**
 * Contrato de armazenamento de arquivos (fotos de perfil, mídias de partidas).
 *
 * O resto do código depende SÓ desta interface. Para ir para produção basta
 * criar uma nova implementação e trocar em `storage/index.ts`:
 *
 *   - S3StorageProvider: @aws-sdk/client-s3 -> PutObjectCommand({ Bucket, Key, Body: file.buffer,
 *     ContentType }) e URL pública via CloudFront. delete -> DeleteObjectCommand.
 *   - CloudinaryStorageProvider: cloudinary.uploader.upload_stream({ folder, transformation:
 *     [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }] }) -> secure_url / public_id.
 *     delete -> cloudinary.uploader.destroy(public_id).
 *
 * O Multer (memoryStorage) entrega o arquivo em memória (`buffer`), então o
 * mesmo upload funciona para disco local, S3 ou Cloudinary.
 */
export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface StoredFile {
  /** URL pública para gravar no banco e exibir no app */
  url: string;
}

export interface StorageProvider {
  save(file: UploadFile, folder: string): Promise<StoredFile>;
  /** Remove um arquivo pela URL salva. Deve ser tolerante: arquivo inexistente não é erro. */
  delete(url: string): Promise<void>;
}
