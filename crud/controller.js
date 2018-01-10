const Status = require('http-status');
const ValidationException = require('./validation-exception');
const DuplicationException = require('./duplication-exception');

exports.list = (mapper) => {
  return async(ctx) =>
  {
    const result = await mapper.list(ctx.request.query);
    ctx.body = mapper.toHalCollection(result, ctx);
    ctx.status = 200;
  }
}

exports.create = (mapper) => {
  return async (ctx) => {
    try {
      const result = await mapper.create(ctx.request.body);
      ctx.body = mapper.toHal(result, ctx.router);
      ctx.status = Status.CREATED;
    } catch (e) {
      if (e instanceof ValidationException) {
        ctx.throw(Status.UNPROCESSABLE_ENTITY, {message: e.errors});
        return;
      } else if (e instanceof DuplicationException) {
        ctx.throw(Status.CONFLICT, {message: 'There is an entity with this ' + e.errors});
        return;
      }
      throw e;
    }
  }
}

exports.detail = (mapper) => {
  return async(ctx) =>
  {
    let result = await mapper.detail(ctx.params.id, ctx.query.deleted || ctx.query.disabled);
    if (result === null) {
      ctx.throw(Status.NOT_FOUND, 'Entity not found');
    }
    ctx.body = mapper.toHal(result, ctx.router);
    ctx.status = Status.OK;
  }
}

exports.delete = (mapper) => {
  return async(ctx) =>
  {
    const result = await mapper.delete(ctx.params.id);
    if (result === null || result.n === 0) {
      ctx.throw(Status.NOT_FOUND, 'Entity not found');
    }
    ctx.status = Status.NO_CONTENT;
    ctx.body = null;
  }
}

exports.remove = (mapper) => {
  return async(ctx) =>
  {
    const result = await mapper.remove(ctx.params.id);
    if (result === null || result.n === 0) {
      ctx.throw(Status.NOT_FOUND, 'Entity not found');
    }
    ctx.status = Status.NO_CONTENT;
    ctx.body = null;
  }
}

exports.update = (mapper) => {
  return async(ctx) =>
  {
    try {
      const result = await mapper.update(ctx.params.id, ctx.request.body, ctx.query.deleted || ctx.query.disabled);
      if (result === null) {
        ctx.throw(Status.NOT_FOUND, 'Entity not found');
        return;
      }
      ctx.body = mapper.toHal(result, ctx.router);
      ctx.status = Status.OK;
    } catch (e) {
      if (e instanceof ValidationException) {
        ctx.throw(Status.UNPROCESSABLE_ENTITY, {message: e.errors});
        return;
      } else if (e instanceof DuplicationException) {
        ctx.throw(Status.CONFLICT, {message: 'There is an entity with this ' + e.errors});
        return;
      }
      throw e;
    }
  }
}
