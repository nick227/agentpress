import { YoutubeService } from './apps/server/src/services/YoutubeService';

async function test() {
  const yt = new YoutubeService();
  const meta = await yt.getVideoMetadata('dQw4w9WgXcQ');
  console.log('Meta:', meta);
}
test().catch(console.error);
