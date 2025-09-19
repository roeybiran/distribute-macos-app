import { join } from 'path';

export const XCODE_PATHS = {
  ARCHIVES: join(process.env.HOME!, 'Library/Developer/Xcode/Archives')
}

export const APP_PATHS = {
  CACHE: join(process.env.HOME!, 'Library/Caches/com.roeybiran.distribute-macos-app')
}