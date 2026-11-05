import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import { messageSchema, type Message, type MessageInput, type MessageStatus } from '@app/schemas';

/** Contact form messages. Sending is public; everything else requires a token. */
export class MessagesApi extends BaseApiClient {
  async create(input: MessageInput): Promise<Message> {
    return this.parse(await this.send('POST', '/messages', { data: input }), messageSchema);
  }

  getResponse(messageId: string): Promise<APIResponse> {
    return this.send('GET', `/messages/${messageId}`);
  }

  replyResponse(messageId: string, message: string): Promise<APIResponse> {
    return this.send('POST', `/messages/${messageId}/reply`, { data: { message } });
  }

  updateStatusResponse(messageId: string, status: MessageStatus): Promise<APIResponse> {
    return this.send('PUT', `/messages/${messageId}/status`, { data: { status } });
  }
}
