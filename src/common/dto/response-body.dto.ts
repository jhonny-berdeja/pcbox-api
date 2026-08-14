/** Generic envelope wrapping every non-error API response. */
export class ResponseBody<T> {
  msg!: string;
  data!: T;

  static builder<T>(): ResponseBodyBuilder<T> {
    return new ResponseBodyBuilder<T>();
  }
}

/** Fluent builder for `ResponseBody<T>` — stays generic, no knowledge of any particular `T`. */
export class ResponseBodyBuilder<T> {
  private msg?: string;
  private data?: T;

  withMsg(msg: string): this {
    this.msg = msg;
    return this;
  }

  withData(data: T): this {
    this.data = data;
    return this;
  }

  build(): ResponseBody<T> {
    if (this.msg === undefined) {
      throw new Error('ResponseBody.Builder: msg is required');
    }
    if (this.data === undefined) {
      throw new Error('ResponseBody.Builder: data is required');
    }

    const body = new ResponseBody<T>();
    body.msg = this.msg;
    body.data = this.data;
    return body;
  }
}
