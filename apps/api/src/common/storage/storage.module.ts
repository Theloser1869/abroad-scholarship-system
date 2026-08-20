import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HeuristicMalwareScanProvider } from './heuristic-malware-scan.provider';
import { LocalFilesystemStorageProvider } from './local-filesystem-storage.provider';
import { MALWARE_SCAN_PROVIDER } from './malware-scan-provider.interface';
import { R2StorageProvider } from './r2-storage.provider';
import { SignedUrlService } from './signed-url.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage-provider.interface';

/// `STORAGE_PROVIDER=local` (default, dev/test) or `STORAGE_PROVIDER=r2` (free-remote-
/// deployment target — Cloudflare R2) selects the bound implementation. Neither
/// `DocumentsService` nor any other caller knows which one is active — see
/// `storage-provider.interface.ts`. `assertProductionConfigSafe()` (`main.ts`) separately
/// refuses to boot with `NODE_ENV=production` and `STORAGE_PROVIDER` still `local`/unset —
/// this factory itself only decides which class to build, the earlier boot-time check is
/// what stops the unsafe combination from ever reaching here.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService): StorageProvider => {
        const provider = (config.get<string>('STORAGE_PROVIDER') ?? 'local').toLowerCase();
        if (provider === 'r2') return new R2StorageProvider(config);
        if (provider !== 'local') {
          throw new Error(`Unknown STORAGE_PROVIDER "${provider}" — expected "local" or "r2".`);
        }
        return new LocalFilesystemStorageProvider(config);
      },
      inject: [ConfigService],
    },
    { provide: MALWARE_SCAN_PROVIDER, useClass: HeuristicMalwareScanProvider },
    SignedUrlService,
  ],
  exports: [STORAGE_PROVIDER, MALWARE_SCAN_PROVIDER, SignedUrlService],
})
export class StorageModule {}
