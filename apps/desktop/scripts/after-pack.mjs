import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * electron-builder leaves the app at the linker's ad-hoc signature when no
 * Developer ID is configured. Sign the whole bundle ad-hoc so nested helpers
 * and resources are sealed and the app runs on Apple silicon without a
 * Developer ID (users may still need to approve the first launch).
 */
export default async function afterPack(context) {
  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  )
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--identifier', 'com.dailywork.app', appPath],
    { stdio: 'inherit' },
  )
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
  console.log(`ad-hoc signed ${appPath}`)
}
