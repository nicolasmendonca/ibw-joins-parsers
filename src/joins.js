/**
 * @typedef {Object} EventOcurrence
 * @property {'before'|'after'} ocurrence
 * @property {number} timeUnit
 * @property {'days'|'hours'} timeScale
 */

/**
 * @typedef {Object} JoinUiModel
 * @property {string} id
 * @property {string|null} sourceLogrepo
 * @property {string|null} sourceField
 * @property {string|null} targetLogrepoName
 * @property {string|null} targetLogrepoField
 * @property {'1-to-1'|'1-to-n'} relationship
 * @property {EventOcurrence|null} eventOccurrence
 * @property {null} filter
 * @property {any[]} children
 */

/**
 * @typedef {Object} joinBackendModel
 * @property {string} joinBackendModel.parent
 * @property {string} joinBackendModel.parent_field
 * @property {string} joinBackendModel.child
 * @property {string} joinBackendModel.child_logrepo_name
 * @property {string} joinBackendModel.child_field
 * @property {boolean} joinBackendModel.one_to_one
 * @property {number} joinBackendModel.timeRangeStartBeforeHours
 * @property {number} joinBackendModel.timeRangeEndAfterHours
 * @returns {JoinUiModel}
 */

export function generateUUID() {
  return Math.random()
    .toString(36)
    .substring(2, 15);
}

/**
 * @param {JoinUiModel} joinData
 * @returns {JoinUiModel}
 */
export const createJoin = (joinData = {}) => ({
  id: generateUUID(),
  sourceLogrepo: null,
  sourceField: null,
  targetLogrepoName: null,
  targetLogrepoField: null,
  relationship: "1-to-1",
  eventOccurrence: {
    occurrence: "before",
    timeUnit: 1,
    timeScale: "days"
  },
  filter: null,
  children: [],
  ...joinData
});

export const createEventOccurrence = ({
  timeRangeStartBeforeHours,
  timeRangeEndAfterHours
}) => {
  const occurrence =
    timeRangeStartBeforeHours > timeRangeEndAfterHours ? "before" : "after";

  let timeUnit = timeRangeStartBeforeHours || timeRangeEndAfterHours;
  let timeScale = "hours";

  if (timeUnit > 0 && timeUnit % 24 === 0) {
    timeScale = "days";
    timeUnit /= 24;
  }

  return {
    occurrence,
    timeUnit,
    timeScale
  };
};

/**
 * @param {JoinBackendModel} joinBackendModel
 */
export const createJoinFromBackendModel = (joinBackendModel, sourceLogrepo) => {
  return createJoin({
    sourceLogrepo,
    sourceField: joinBackendModel.parentField,
    targetLogrepoName: joinBackendModel.logrepoName,
    targetLogrepoField: joinBackendModel.childField,
    relationship: joinBackendModel.oneToOne ? "1-to-1" : "1-to-n",
    eventOccurrence: createEventOccurrence(joinBackendModel),
    filter: null,
    children: []
  });
};

/**
 * @param {JoinUiModel[]} joinsUiModel
 * @returns {JoinUiModel[]}
 */
export const createTreeStructureForJoins = (joinsUiModel, baseLogrepoName) =>
  joinsUiModel
    .filter(join => join.sourceLogrepo === baseLogrepoName)
    .map(join => ({
      ...join,
      children: createTreeStructureForJoins(
        joinsUiModel,
        join.targetLogrepoName
      )
    }));

/**
 * @param {JoinBackendModel[]} joins
 */
export const parseFromAPI = (joins, baseLogrepoName) =>
  joins.map(join => {
    const joinUiModel = createJoinFromBackendModel(join, baseLogrepoName);
    return {
      ...joinUiModel,
      children: parseFromAPI(join.joins, joinUiModel.targetLogrepoName)
    };
  });

/**
 * @param {JoinUIModel[]} joins
 * @returns {JoinUiModel[]}
 */
const flattenChildrenJoins = (joins, parentLogrepoName) =>
  [
    joins,
    joins.map(join => flattenChildrenJoins(join.children, join.logrepoName))
  ].flat(Infinity);

/**
 * @param {JoinUiModel} join
 */
const createBackendEventOccurrence = ({ eventOccurrence }) => {
  const multipliers = {
    hours: 1,
    days: 24
  };

  let hours = eventOccurrence.timeUnit * multipliers[eventOccurrence.timeScale];

  return {
    timeRangeStartBeforeHours:
      eventOccurrence.ocurrence === "before" ? hours : 0,
    timeRangeEndAfterHours: eventOccurrence === "after" ? hours : 0
  };
};

/**
 * @param {JoinUiModel[]} joins
 * @returns {JoinBackendModel[]}
 */
export const parseToAPI = (joins, parentLogrepoName) =>
  flattenChildrenJoins(joins, parentLogrepoName).map(join => {
    return {
      parent: join.sourceLogrepo,
      logrepoName: join.targetLogrepoName,
      parentField: join.sourceField,
      childField: join.targetLogrepoField,
      oneToOne: join.relationship === "1-to-1",
      ...createBackendEventOccurrence(join)
    };
  });
