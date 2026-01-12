import { Response } from 'express';

interface EventConnection {
  userId: number;
  res: Response;
}

export class EventService {
  private connections: EventConnection[] = [];

  public addConnection(userId: number, res: Response) {
    const connection = { userId, res };
    this.connections.push(connection);

    res.on('close', () => {
      this.connections = this.connections.filter((c) => c !== connection);
    });
  }

  private sendEvent(res: Response, type: string, data: any) {
    // Standard SSE format
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

    /**
     * SENIOR FIX: Manual Flush
     * If you use 'compression' middleware, res.flush() is mandatory.
     * If not, this is a safety measure for some proxy servers.
     */
    if ((res as any).flush) {
      (res as any).flush();
    }
  }

  public emitToUser(userId: number, type: string, data: any) {
    const targets = this.connections.filter((c) => c.userId === userId);
    targets.forEach((conn) => this.sendEvent(conn.res, type, data));
  }

  public broadcast(type: string, data: any) {
    this.connections.forEach((conn) => this.sendEvent(conn.res, type, data));
  }
}

export const eventService = new EventService();
