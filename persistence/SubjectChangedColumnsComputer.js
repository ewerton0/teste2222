"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DateUtils_1 = require("../util/DateUtils");
var EntityMetadata_1 = require("../metadata/EntityMetadata");
var OrmUtils_1 = require("../util/OrmUtils");
/**
 * Finds what columns are changed in the subject entities.
 */
var SubjectChangedColumnsComputer = /** @class */ (function () {
    function SubjectChangedColumnsComputer() {
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Finds what columns are changed in the subject entities.
     */
    SubjectChangedColumnsComputer.prototype.compute = function (subjects) {
        var _this = this;
        subjects.forEach(function (subject) {
            _this.computeDiffColumns(subject);
            _this.computeDiffRelationalColumns(subjects, subject);
        });
    };
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    /**
     * Differentiate columns from the updated entity and entity stored in the database.
     */
    SubjectChangedColumnsComputer.prototype.computeDiffColumns = function (subject) {
        // if there is no persisted entity then nothing to compute changed in it
        if (!subject.entity)
            return;
        subject.metadata.columns.forEach(function (column) {
            // ignore special columns
            if (column.isVirtual ||
                column.isDiscriminator ||
                column.isUpdateDate ||
                column.isVersion ||
                column.isCreateDate)
                return;
            var changeMap = subject.changeMaps.find(function (changeMap) { return changeMap.column === column; });
            if (changeMap) {
                subject.changeMaps.splice(subject.changeMaps.indexOf(changeMap), 1);
            }
            // get user provided value - column value from the user provided persisted entity
            var entityValue = column.getEntityValue(subject.entity);
            // we don't perform operation over undefined properties (but we DO need null properties!)
            if (entityValue === undefined)
                return;
            // if there is no database entity then all columns are treated as new, e.g. changed
            if (subject.databaseEntity) {
                // get database value of the column
                var databaseValue = column.getEntityValue(subject.databaseEntity);
                // filter out "relational columns" only in the case if there is a relation object in entity
                if (column.relationMetadata) {
                    var value = column.relationMetadata.getEntityValue(subject.entity);
                    if (value !== null && value !== undefined)
                        return;
                }
                var normalizedValue = entityValue;
                // normalize special values to make proper comparision
                if (entityValue !== null) {
                    if (column.type === "date") {
                        normalizedValue = DateUtils_1.DateUtils.mixedDateToDateString(entityValue);
                    }
                    else if (column.type === "time") {
                        normalizedValue = DateUtils_1.DateUtils.mixedDateToTimeString(entityValue);
                    }
                    else if (column.type === "datetime" || column.type === Date) {
                        normalizedValue = DateUtils_1.DateUtils.mixedDateToUtcDatetimeString(entityValue);
                        databaseValue = DateUtils_1.DateUtils.mixedDateToUtcDatetimeString(databaseValue);
                    }
                    else if (column.type === "json" || column.type === "jsonb") {
                        // JSON.stringify doesn't work because postgresql sorts jsonb before save.
                        // If you try to save json '[{"messages": "", "attribute Key": "", "level":""}] ' as jsonb,
                        // then postgresql will save it as '[{"level": "", "message":"", "attributeKey": ""}]'
                        if (OrmUtils_1.OrmUtils.deepCompare(entityValue, databaseValue))
                            return;
                    }
                    else if (column.type === "simple-array") {
                        normalizedValue = DateUtils_1.DateUtils.simpleArrayToString(entityValue);
                        databaseValue = DateUtils_1.DateUtils.simpleArrayToString(databaseValue);
                    }
                    else if (column.type === "simple-enum") {
                        normalizedValue = DateUtils_1.DateUtils.simpleEnumToString(entityValue);
                        databaseValue = DateUtils_1.DateUtils.simpleEnumToString(databaseValue);
                    }
                }
                // if value is not changed - then do nothing
                if (normalizedValue === databaseValue)
                    return;
            }
            subject.diffColumns.push(column);
            subject.changeMaps.push({
                column: column,
                value: entityValue
            });
        });
    };
    /**
     * Difference columns of the owning one-to-one and many-to-one columns.
     */
    SubjectChangedColumnsComputer.prototype.computeDiffRelationalColumns = function (allSubjects, subject) {
        // if there is no persisted entity then nothing to compute changed in it
        if (!subject.entity)
            return;
        subject.metadata.relationsWithJoinColumns.forEach(function (relation) {
            // get the related entity from the persisted entity
            var relatedEntity = relation.getEntityValue(subject.entity);
            // we don't perform operation over undefined properties (but we DO need null properties!)
            if (relatedEntity === undefined)
                return;
            // if there is no database entity then all relational columns are treated as new, e.g. changed
            if (subject.databaseEntity) {
                // here we cover two scenarios:
                // 1. related entity can be another entity which is natural way
                // 2. related entity can be just an entity id
                // if relation entity is just a relation id set (for example post.tag = 1)
                // then we create an id map from it to make a proper comparision
                var relatedEntityRelationIdMap = relatedEntity;
                if (relatedEntityRelationIdMap !== null && relatedEntityRelationIdMap instanceof Object)
                    relatedEntityRelationIdMap = relation.getRelationIdMap(relatedEntityRelationIdMap);
                // get database related entity. Since loadRelationIds are used on databaseEntity
                // related entity will contain only its relation ids
                var databaseRelatedEntityRelationIdMap = relation.getEntityValue(subject.databaseEntity);
                // if relation ids are equal then we don't need to update anything
                var areRelatedIdsEqual = EntityMetadata_1.EntityMetadata.compareIds(relatedEntityRelationIdMap, databaseRelatedEntityRelationIdMap);
                if (areRelatedIdsEqual) {
                    return;
                }
                else {
                    subject.diffRelations.push(relation);
                }
            }
            // if there is an inserted subject for the related entity of the persisted entity then use it as related entity
            // this code is used for related entities without ids to be properly inserted (and then updated if needed)
            var valueSubject = allSubjects.find(function (subject) { return subject.mustBeInserted && subject.entity === relatedEntity; });
            if (valueSubject)
                relatedEntity = valueSubject;
            // find if there is already a relation to be changed
            var changeMap = subject.changeMaps.find(function (changeMap) { return changeMap.relation === relation; });
            if (changeMap) { // and update its value if it was found
                changeMap.value = relatedEntity;
            }
            else { // if it wasn't found add a new relation for change
                subject.changeMaps.push({
                    relation: relation,
                    value: relatedEntity
                });
            }
        });
    };
    return SubjectChangedColumnsComputer;
}());
exports.SubjectChangedColumnsComputer = SubjectChangedColumnsComputer;

//# sourceMappingURL=SubjectChangedColumnsComputer.js.map
