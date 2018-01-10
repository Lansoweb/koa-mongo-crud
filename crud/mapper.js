
const hal = require('hal');
const mongo = require('mongodb');
const queryString = require('query-string');
const ValidationException = require('./validation-exception');
const DuplicationException = require('./duplication-exception');
const Uuid = require('../infra/uuid');
const MongoQF = require('./mongodb-query-filter');
const ajv = require('ajv')({
  removeAdditional: true,
  allErrors: true
});

class CrudMapper {

  constructor(db, schema, options = {}) {
    this.schema = schema;
    this.collectionName = options.collectionName || schema.collectionName;
    this.collection = db.collection(this.collectionName);
    this.detailRoute = options.detailRoute || schema.name+'.detail';
    this.listRoute = options.listRoute || schema.name+'.list';
    this.pageSize = 25;
    this.queryFilter = createQueryFilter(schema);

    if (this.schema.hasOwnProperty('unique') === false) {
      this.schema.unique = [];
    }
  }

  async list(paramsOrig) {

    let params = JSON.parse(JSON.stringify(paramsOrig))

    const withDeleted = params.deleted || params.disabled || false;
    const withCount = params._count || false;

    const query = this.queryFilter.parse(params);

    if (withDeleted === '1' || withDeleted === 'true') {
      delete query.deleted;
    } else {
      query.deleted = { $ne: true };
    }

    params.fields = params.fields || '';
    const fields = params.fields.split(',');
    let project = {};
    fields.forEach((field) => {
      if (field.length > 0) {
        project[field] = 1;
      }
    });
    const page = parseInt(params.page || 1);
    const skip = (page - 1) * this.pageSize;

    const list = await this.collection
      .find(query)
      .project(project)
      .limit(this.pageSize)
      .skip(skip)
      .sort({createdAt: -1})
      .toArray();

    let result = {
      result: list,
      page: page,
    };

    if (withCount === '1' || withCount === 'true' || withCount === true) {
      const count = await this.collection.find(query).count();
      result['count'] = count;
      result['page_count'] = Math.ceil(count / list.length);
    }

    return result;
  }

  async detail(id, withDeleted = false) {

    let filter = { _id: id };

    if (withDeleted === false) {
      filter.deleted = { $ne: true };
    }

    return await this.collection.findOne(filter);
  }

  async create(post) {
    post = this.validateAll(post);
    let data = this.toDatabase(post);

    await this.checkUniqueness(data);

    data._id = Uuid.v4c();
    data.createdAt = new Date();
    data.updatedAt = data.createdAt;
    await this.collection.insertOne(data);
    return data;
  }

  async checkUniqueness(data, id = null) {
    if (this.schema.unique.length > 0) {
      let orFilter = [];
      this.schema.unique.forEach((key) => {
        if (data.hasOwnProperty(key)) {
          if (typeof data[key] === 'object') {
            data[key].forEach((value) => {
              let obj = {};
              obj[key] = value;
              orFilter.push(obj);
            });
          } else {
            let obj = {};
            obj[key] = data[key];
            orFilter.push(obj);
          }
        }
      });
      if (orFilter.length === 0) {
        return;
      }
      let filter = { $or: orFilter, deleted: { $ne: true } };
      if (id !== null) {
        filter['_id'] = { $ne : id };
      }
      const list = await this.collection.find(filter).toArray();
      if (list.length === 0) {
        return;
      }
      let message = [];
      list.forEach((json) => {
        this.schema.unique.forEach((key) => {
          if (data.hasOwnProperty(key) && json.hasOwnProperty(key)) {
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

    let filter = { _id: id };

    if (withDeleted === false) {
      filter.deleted = { $ne: true };
    }

    post = this.validate(post);
    let data = this.toDatabase(post);

    await this.checkUniqueness(data, id);

    data.updatedAt = new Date();

    let update = {}
    if (data.deleted !== true) {
      delete data.deleted;
      delete data.deletedAt;
      delete data.deletedBy;
      update = { $set: data, $unset: {deleted: "", deletedAt: "", deletedBy: ""} };
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

    let data = {
      deleted: true,
      deletedAt: new Date()
    };
    if (userId !== null) {
      data.deletedBy = userId;
    }

    const result = await this.collection.findOneAndUpdate(
      { _id: id, deleted: { $ne: true } },
      { $set: data },
      { returnOriginal: false, upsert: false }
    );

    if (result.ok !== 1) {
      return null;
    }

    return result.value;
  }

  async remove(id) {

    let filter = { _id: id };

    const result = await this.collection.findOneAndDelete(filter);

    return result.ok === 1;
  }

  toJson(data) {
    let json = Object.assign({ id: data._id }, data);
    delete json._id;
    if (json.deleted === false) {
      delete json.deleted;
      delete json.deletedAt;
      delete json.deletedBy;
    }
    return json;
  }

  toHal(result, router) {
    let json = this.toJson(result);
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

    let entities = [];

    for (let i=0; i<result.result.length; i++) {
      entities.push(this.toHal(result.result[i], ctx.router));
    }

    let query = ctx.request.query;

    let collectionUrl = ctx.router.url(this.listRoute);
    if (queryString.stringify(query).length > 0) {
      collectionUrl += '?' + queryString.stringify(query);
    }

    let paginationData = {
      _page: result.page,
      _count: entities.length
    };

    if (result.hasOwnProperty('count')) {
      paginationData['_total_items'] = result.count || 0;
    }
    if (result.hasOwnProperty('page_count')) {
      paginationData['_page_count'] = result.page_count || 1;
    }

    let collection = new hal.Resource(paginationData, collectionUrl);

    if (result.page > 2) {
      query.page = 1;
      collection.link('first', ctx.router.url(this.listRoute) + '?' + queryString.stringify(query));
    }
    if (result.page > 1) {
      query.page = result.page - 1;
      collection.link('prev', ctx.router.url(this.listRoute) +'?'+ queryString.stringify(query));
    }

    query.page = result.page + 1;
    collection.link('next', ctx.router.url(this.listRoute) + '?' + queryString.stringify(query));

    if (result.hasOwnProperty('page_count') && result.page < result.page_count - 1) {
      query.page = result.page_count;
      collection.link('last', ctx.router.url(this.listRoute) +'?'+ queryString.stringify(query));
    }

    collection.embed(this.collectionName, entities, false);
    return collection;
  }

  toDatabase(entity) {
    let data = entity;
    if (data.id) {
      data._id = data.id;
    }
    delete data.id;
    return data;
  }

  validate(data, validateAll = false) {

    let schema = this.schema;
    if (validateAll === false) {
      delete schema.required;
    }

    schema.properties['deleted'] = { type: 'boolean', default: false};
    schema.properties['deletedAt'] = { type: 'string', format: 'date-time'};
    schema.properties['deletedBy'] = { type: ['string', 'null']};

    let valid = ajv.validate(schema, data);

    if (!valid) {
      throw new ValidationException(ajv.errors);
    }

    return data;
  }

  validateAll(data) {
    return this.validate(data, true)
  }
}

function createQueryFilter(schema) {
  if (schema.hasOwnProperty('searchable') === false) {
    schema.searchable = Object.keys(schema.properties);
  }
  let whitelist = {after:1, before: 1, between: 1};
  schema.searchable.forEach((key) => {
    whitelist[key] = 1;
  });
  return new MongoQF({
    custom: {
      between: 'updatedAt',
      after: 'updatedAt',
      before: 'updatedAt'
    },
    whitelist: whitelist,
  });
}

module.exports = CrudMapper;
