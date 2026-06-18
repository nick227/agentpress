import { PipelineRunService } from './apps/server/src/services/PipelineRunService';

async function test() {
  const svc = new PipelineRunService();
  try {
    const run = await svc.startRun('hatsyshirtsy', {}, false);
    console.log("Success:", run.id);
  } catch (err) {
    console.error("Error calling startRun:", err);
  }
}
test().catch(console.error);
