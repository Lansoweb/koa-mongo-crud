
const hal = require('hal');
const queryString = require('query-string');
const moment = require('moment');
const ajv = require('ajv')({
  removeAdditional: true,
  allErrors: true,
});
const ValidationException = require('./validation-exception');
const DuplicationException = require('./duplication-exception');
const Uuid = require('../infra/uuid');
const MongoQF = require('./mongodb-query-filter');

function createQueryFilter(schema) {
  if (Object.prototype.hasOwnProperty.call(schema, 'searchable') === false) {
    // eslint-disable-next-line no-param-reassign
    schema.searchable = Object.keys(schema.properties);
  }
  const whitelist = { after: 1, before: 1, between: 1 };
  schema.searchable.forEach((key) => {
    whitelist[key] = 1;
  });
  return new MongoQF({
    custom: {
      between: 'updatedAt',
      after: 'updatedAt',
      before: 'updatedAt',
    },
    whitelist,
  });
}

class CrudMapper {
  constructor(db, schema, options = {}) {
    this.schema = schema;
    this.collectionName = options.collectionName || schema.collectionName;
    this.collection = db.collection(this.collectionName);
    this.detailRoute = options.detailRoute || `${schema.name}.detail`;
    this.listRoute = options.listRoute || `${schema.name}.list`;
    this.pageSize = 25;
    this.queryFilter = createQueryFilter(schema);

    if (Object.prototype.hasOwnProperty.call(this.schema, 'unique') === false) {
      this.schema.unique = [];
    }
  }

  async list(paramsOrig, aggregateParam) {
    const params = JSON.parse(JSON.stringify(paramsOrig));

    const withDeleted = params.deleted || params.disabled || false;
    const withCount = params._count || false;
    let pageSize = parseInt(params._pageSize || params.pageSize || this.pageSize, 10);
    const sortBy = params.sort || 'createdAt';
    const orderBy = parseInt(params.order || -1, 10);
    const sort = {};
    sort[sortBy] = orderBy;

    const query = this.queryFilter.parse(params);

    if (withDeleted === '1' || withDeleted === 'true') {
      delete query.deleted;
    } else {
      query.deleted = { $ne: true };
    }

    this.checkDates(this.schema.properties, query);

    params.fields = params.fields || '';
    const fields = params.fields.split(',');
    const project = {};
    fields.forEach((field) => {
      if (field.length > 0) {
        project[field] = 1;
      }
    });

    const page = parseInt(params.page || 1, 10);
    let skip = (page - 1) * pageSize;

    if (aggregateParam && page > 1) {
      const aux = pageSize;
      pageSize *= page;
      skip = pageSize - aux;
    }

    let list = null;
    if (aggregateParam) {
      list = await this.collection.aggregate().lookup(aggregateParam)
        .match(query)
        .sort(sort)
        .limit(pageSize)
        .skip(skip)
        .toArray();
    } else {
      list = await this.collection
        .find(query)
        .project(project)
        .sort(sort)
        .limit(pageSize)
        .skip(skip)
        .toArray();
    }

    const result = {
      result: list,
      page,
    };

    if (withCount === '1' || withCount === 'true' || withCount === true) {
      const count = await this.collection.find(query).count();
      result.count = count;
      result.page_count = Math.ceil(count / pageSize);
    }

    return result;
  }

  async detail(id, withDeleted = false) {
    const filter = { _id: id };

    if (withDeleted === false) {
      filter.deleted = { $ne: true };
    }

    return this.collection.findOne(filter);
  }

  async create(post) {
    const validated = this.validateAll(post);
    const data = this.toDatabase(validated);

    await this.checkUniqueness(data);

    // if (data.hasOwnProperty('_id') === false) {
    data._id = CrudMapper.generateUuid();
    // }
    data.createdAt = new Date();
    data.updatedAt = data.createdAt;
    await this.collection.insertOne(data);
    return data;
  }

  async checkUniqueness(data, id = null) {
    if (this.schema.unique.length > 0) {
      const orFilter = [];
      this.schema.unique.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          if (typeof data[key] === 'object') {
            data[key].forEach((value) => {
              const obj = {};
              obj[key] = value;
              orFilter.push(obj);
            });
          } else {
            const obj = {};
            obj[key] = data[key];
            orFilter.push(obj);
          }
        }
      });
      if (orFilter.length === 0) {
        return;
      }
      const filter = { $or: orFilter, deleted: { $ne: true } };
      if (id !== null) {
        filter._id = { $ne: id };
      }
      const list = await this.collection.find(filter).toArray();
      if (list.length === 0) {
        return;
      }
      const message = [];
      list.forEach((json) => {
        this.schema.unique.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(data, key) && Object.prototype.hasOwnProperty.call(json, key)) {
            if (typeof data[key] === 'object') {
              data[key].forEach((dataValue) => {
                json[key].forEach((jsonValue) => {
                  if (jsonValue === dataValue) {
                    message.push(key);
                  }
                });
              });
            } else if (data[key] === json[key]) {
              message.push(key);
            }
          }
        });
      });
      throw new DuplicationException(message.filter((v, i, a) => a.indexOf(v) === i));
    }
  }

  async update(id, post, withDeleted = false) {
    const filter = { _id: id };

    if (withDeleted === false) {
      filter.deleted = { $ne: true };
    }

    const validated = this.validate(post);
    const data = this.toDatabase(validated);

    await this.checkUniqueness(data, id);

    data.updatedAt = new Date();

    let update = {};
    if (data.deleted !== true) {
      delete data.deleted;
      delete data.deletedAt;
      delete data.deletedBy;
      update = { $set: data, $unset: { deleted: '', deletedAt: '', deletedBy: '' } };
    } else {
      data.deleted = true;
      data.deletedAt = new Date();
      update = { $set: data };
    }

    const result = await this.collection.findOneAndUpdate(filter, update, { returnOriginal: false, upsert: false });
    if (result.ok !== 1) {
      return null;
    }
    return result.value;
  }

  async delete(id, userId = null) {
    const data = {
      deleted: true,
      deletedAt: new Date(),
    };
    if (userId !== null) {
      data.deletedBy = userId;
    }

    const result = await this.collection.findOneAndUpdate(
      { _id: id, deleted: { $ne: true } },
      { $set: data },
      { returnOriginal: false, upsert: false },
    );

    if (result.ok !== 1) {
      return null;
    }

    return result.value;
  }

  async remove(id) {
    const filter = { _id: id };

    const result = await this.collection.findOneAndDelete(filter);

    return result.ok === 1;
  }

  static toJson(data) {
    const json = { id: data._id, ...data };
    delete json._id;
    if (json.deleted === false) {
      delete json.deleted;
      delete json.deletedAt;
      delete json.deletedBy;
    }
    return json;
  }

  toHal(result, router) {
    const json = CrudMapper.toJson(result);
    if (result.deleted === true) {
      if (result.deletedAt) {
        json.deletedAt = result.deletedAt;
      }
      if (result.deletedBy) {
        json.deletedBy = result.deletedBy;
      }
    }
    let id = result._id || result.id;
    if (typeof id === 'object') {
      id = id.toString();
    }
    return new hal.Resource(json, router.url(this.detailRoute, id));
  }

  toHalCollection(result, ctx) {
    const entities = [];

    for (let i = 0; i < result.result.length; i += 1) {
      entities.push(this.toHal(result.result[i], ctx.router));
    }

    const { query } = ctx.request;

    let collectionUrl = ctx.router.url(this.listRoute);
    if (queryString.stringify(query).length > 0) {
      collectionUrl += `?${queryString.stringify(query)}`;
    }

    const paginationData = {
      _page: result.page,
      _count: entities.length,
    };

    if (Object.prototype.hasOwnProperty.call(result, 'count')) {
      paginationData._total_items = result.count || 0;
    }
    if (Object.prototype.hasOwnProperty.call(result, 'page_count')) {
      paginationData._page_count = result.page_count || 1;
    }

    const collection = new hal.Resource(paginationData, collectionUrl);

    if (result.page > 2) {
      query.page = 1;
      collection.link('first', `${ctx.router.url(this.listRoute)}?${queryString.stringify(query)}`);
    }
    if (result.page > 1) {
      query.page = result.page - 1;
      collection.link('prev', `${ctx.router.url(this.listRoute)}?${queryString.stringify(query)}`);
    }

    query.page = result.page + 1;
    collection.link('next', `${ctx.router.url(this.listRoute)}?${queryString.stringify(query)}`);

    if (Object.prototype.hasOwnProperty.call(result, 'page_count') && result.page < result.page_count - 1) {
      query.page = result.page_count;
      collection.link('last', `${ctx.router.url(this.listRoute)}?${queryString.stringify(query)}`);
    }

    collection.embed(this.collectionName, entities, false);
    return collection;
  }

  toDatabase(entity) {
    const data = entity;
    if (Object.prototype.hasOwnProperty.call(data, 'id')) {
      data._id = data.id;
      delete data.id;
    }

    this.checkDates(this.schema.properties, data);

    return data;
  }

  validate(data, validateAll = false) {
    const { schema } = this;
    if (validateAll === false) {
      delete schema.required;
    }

    schema.properties.deleted = { type: 'boolean', default: false };
    schema.properties.deletedAt = { type: 'string', format: 'date-time' };
    schema.properties.deletedBy = { type: ['string', 'null'] };

    const valid = ajv.validate(schema, data);

    if (!valid) {
      throw new ValidationException(ajv.errors);
    }

    return data;
  }

  validateAll(data) {
    return this.validate(data, true);
  }

  static generateUuid() {
    return Uuid.v4c();
  }

  static getUUID() {
    return CrudMapper.generateUuid();
  }

  /**
   * Sets the Date fields
   * @param {[type]} data Current Data
   * @param {[type]} key  Data key name where Date type must be set on
   */
  setDates(data, key) {
    Object.keys(data).forEach((x) => {
      if (typeof data[x] === 'object') {
        this.setDates(data[x], key);
      } else {
        const dateComparisonOperators = ['$gt', '$gte', '$lt', '$lte', '$ne', '$eq', '$in', '$nin'];
        if ((key === x || dateComparisonOperators.indexOf(x) > -1)
          && moment(data[x], moment.ISO_8601, true).isValid()) {
          // eslint-disable-next-line no-param-reassign
          data[x] = new Date(data[x]);
        }
      }
    });
  }

  /**
   * Check for instanceOf Date fields
   * @param  {[type]} schemaProperties Current schema
   * @param  {[type]} data             Current data
   * @return {[type]}                  [description]
   */
  checkDates(schemaProperties, data) {
    Object.keys(schemaProperties).forEach((k) => {
      if (typeof schemaProperties[k] === 'object' && schemaProperties[k].type && schemaProperties[k].type === 'array') {
        this.checkDates(schemaProperties[k].items.properties || {}, data);
      } else if (schemaProperties[k].instanceOf && schemaProperties[k].instanceOf === 'Date') {
        this.setDates(data, k);
      }
    });
  }
}

module.exports = CrudMapper;
