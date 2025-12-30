import { createECDH, randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';

export class Crypto {
  // Use ECDH with prime256v1 (NIST P-256) - fast and widely supported
  private ecdh = createECDH('prime256v1');
  public publicKey: string;

  constructor() {
    this.ecdh.generateKeys();
    this.publicKey = this.ecdh.getPublicKey('hex', 'compressed');
  }

  encrypt(message: string, recipientPublicKey: string): string {
    try {
      // Compute shared secret
      const sharedSecret = this.ecdh.computeSecret(recipientPublicKey, 'hex');
      
      // Hash it to ensure uniform distribution for AES key
      const key = createHash('sha256').update(sharedSecret).digest();
      
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (err) {
      console.error('Encryption failed:', err);
      throw new Error('Failed to encrypt message');
    }
  }

  decrypt(encryptedMessage: string, senderPublicKey: string): string {
    try {
      const [ivHex, encrypted] = encryptedMessage.split(':');
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted message format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      
      // Compute shared secret
      const sharedSecret = this.ecdh.computeSecret(senderPublicKey, 'hex');
      const key = createHash('sha256').update(sharedSecret).digest();
      
      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (err) {
      console.error('Decryption failed:', err);
      return '[Unable to decrypt message]';
    }
  }
}
