/**
 * search logs
 *
 */

'use strict';


var Q = require('q');
var Log = require('../model/log');
var TimeFormat = require('../timeFormat');
var dateTypeEnum = require('../enum/dateType');
var Moment = require('moment');
var _ = require('lodash');
var Project = require('../model/project');
var Task = require('../model/task');
var Msg = require('../message');
var ObjectId = require('mongoose').Types.ObjectId;

exports.query = function(options) {
    var deferred = Q.defer();
    queryLog(options, function(result) {
        deferred.resolve(result.map(function(item) {
            return item.toJSON();
        }));
    }, function(err) {
        deferred.reject(err);
    });
    return deferred.promise;
};


function queryLog(options, onSuccess, onError) {
    var conditions = getQueryConditions(options);
    var hasFilterFlag = hasFilter(options, ['projects', 'tasks', 'versions']);
    Q.allSettled([
        getProjectIds(options.projects, options.versions),
        getTaskIds(options.tasks)
    ]).then(function (idsConditions) {
        idsConditions = _.compact(_.pluck(idsConditions, 'value'));
        if (hasFilterFlag && _.isEmpty(idsConditions)) {
            onSuccess([]);
            return;
        }
        var queryOptions = getQueryOptions(options);
        conditions.$and = conditions.$and.concat(idsConditions);
        var args = [
            conditions,
            options.fields || null,
            queryOptions
        ];
        Log.find.apply(Log, args)
            .populate([{
                path: 'project',
            }, {
                path: 'task'
            }])
            .exec(function(err, result) {
                if (err) {
                    onError(err);
                } else {
                    onSuccess(result);
                }
            });
    });
    function hasFilter(options, keys) {
        return _.intersection(_.keys(options), keys).length > 0;
    }
}


function getQueryConditions(options) {
    var $and = [];
    syncOptions();
    return {$and: $and};

    function syncOptions() {
        var dateCondition = getDateCondition(options);
        if (dateCondition) {
            $and.push(dateCondition);
        }
        var filters = getFilters(options);
        if (!_.isEmpty(filters)) {
            $and = $and.concat(filters);
        }
    }
}


function getQueryOptions(usrOptions) {
    var queryOptions = _.pick(usrOptions, ['limit', 'skip']);
    queryOptions.sort = {date: 1, start: 1};
    return queryOptions;
}


function getDateCondition(options) {
    var condition,
        date = options.dateItems[0];
    if (date) {
        if (date.type === dateTypeEnum.Day) {
            condition = new Date(date.value);
        } else if (date.type === dateTypeEnum.Month) {
            condition = to$Operator(date, 'month');
        } else if (date.type === dateTypeEnum.Year) {
            condition = to$Operator(date, 'year');
        }
    }

    function to$Operator(date, dateType) {
        var m = new Moment(date.value);
        var startDate = m.startOf(dateType).format(TimeFormat.date),
            endDate = m.endOf(dateType).format(TimeFormat.date);
        return {
            $gte: new Date(startDate),
            $lt: new Date(endDate)
        };
    }

    return {
        date: condition
    };
}




function getFilters(options) {
    var filters = [],
        classes = options.classes,
        tags = options.tags;
    if (!_.isEmpty(classes)) {
        filters.push(getArrayOperator('classes', classes, 'code'));
    }

    if (!_.isEmpty(tags)) {
        if (tags.length === 1) {
            filters.push({
                tags: tags[0]
            });
        } else {
            filters.push({
                tags: {
                    $in: tags
                }
            });
        }
    }
    return filters;
}


function getArrayOperator(name, arr, identity) {
    var operator = {},
        $elemMatch = {};
    if (arr.length === 1) {
        $elemMatch[identity] = arr[0];
        operator[name] = {
            $elemMatch: $elemMatch
        };
    } else {
        $elemMatch[identity] = { $in: arr };
        operator[name] = {
            $elemMatch: $elemMatch
        };
    }
    return operator;
}


function getProjectIds(projects, versions) {
    return getIds('project', Project, [
        {value: projects, identity: 'name'},
        {value: versions, identity: 'version'}
    ]);
}


function getTaskIds(tasks) {
    return getIds('task', Task, [
        {value: tasks, identity: 'name'}
    ]);
}


function getIds(typeName, model, userQuerys) {
    var deferred = Q.defer();
    var empty  = _.isEmpty(userQuerys) || userQuerys.filter(function (userQuery) {
        return !_.isEmpty(userQuery.value);
    }).length === 0;
    if (empty) {
        deferred.resolve(null);
        return;
    }
    var condition = {};
    userQuerys.forEach(function (userQuery){
        var query = userQuery.value; 
        if (!_.isEmpty(query)) {
            _.extend(condition, _CD(query, userQuery.identity));
        }
    });
    model.find(condition, function (err, items) {
        var idCondition;
        if (err) {
            Msg.error('Error occur when search with items' + JSON.stringify(condition), err);
            deferred.reject(err);
            return;
        }
        var ids = null;
        if (!_.isEmpty(items)) {
            ids = items.map(function (project) {
                return new ObjectId(project.id);
            });
            idCondition = _CD(ids, typeName);
        } else {
            idCondition = null;
        }

        deferred.resolve(idCondition);
    });
    return deferred.promise;
}

function _CD(items, name) {
    var condition = {};
    var length = items.length;
    if (length === 1) {
        condition[name] = items[0];
    } else if (length > 1){
        condition[name] = {$in: items};
    }
    return condition;
}