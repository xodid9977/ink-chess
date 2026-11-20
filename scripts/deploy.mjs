// 빌드 결과(dist/)를 gh-pages 브랜치로 올려 GitHub Pages에 배포
// 사용: npm run deploy
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();
run('npm run build');
writeFileSync('dist/.nojekyll', ''); // GitHub Pages가 파일을 그대로 쓰도록
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run('git commit -q -m "deploy"', 'dist');
run(`git push -f -q ${remote} gh-pages`, 'dist');
console.log('배포 완료: 잠시 뒤 GitHub Pages 주소에 반영됩니다.');
