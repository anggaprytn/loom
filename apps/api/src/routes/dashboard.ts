import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const webDistDir = path.resolve(process.cwd(), 'apps/web/dist');
const webIndexPath = path.join(webDistDir, 'index.html');

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    const indexHtml = await readBuiltDashboard();
    if (indexHtml) {
      return reply
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(indexHtml);
    }

    return reply.code(503).send({
      error: {
        code: 'DASHBOARD_BUILD_NOT_FOUND',
        message: 'Dashboard build was not found. Run the web build before serving /dashboard.',
      },
    });
  });

  app.get('/assets/:file', async (request, reply) => {
    const params = request.params as { file: string };
    const fileName = path.basename(params.file);
    const filePath = path.join(webDistDir, 'assets', fileName);

    try {
      await access(filePath);
    } catch {
      return reply.code(404).send({
        error: {
          code: 'DASHBOARD_ASSET_NOT_FOUND',
          message: 'Dashboard asset was not found.',
        },
      });
    }

    return reply
      .type(contentTypeFor(fileName))
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(createReadStream(filePath));
  });
}

async function readBuiltDashboard() {
  try {
    return await readFile(webIndexPath, 'utf8');
  } catch {
    return null;
  }
}

function contentTypeFor(fileName: string) {
  if (fileName.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (fileName.endsWith('.css')) return 'text/css; charset=utf-8';
  if (fileName.endsWith('.svg')) return 'image/svg+xml';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}
