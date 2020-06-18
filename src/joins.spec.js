import {
  createJoin,
  createJoinFromBackendModel,
  createTreeStructureForJoins,
  parseFromAPI,
  parseToAPI
} from "./joins";

const createAPIJoin = (parent, child, joins = []) => ({
  logrepoName: child,
  parentField: `${parent}@Field`,
  childField: `${child}@Field`,
  oneToOne: true,
  timeRangeStartBeforeHours: 5,
  timeRangeEndAfterHours: 0,
  joins
});

const createUiJoin = (sourceLogrepo, targetLogrepoName, children = []) =>
  createJoin({
    sourceLogrepo,
    sourceField: `${sourceLogrepo}@Field`,
    targetLogrepoName,
    targetLogrepoField: `${targetLogrepoName}@Field`,
    children
  });

describe("[Joins Parser] - constructor", () => {
  it("creates a valid new join", () => {
    const join = createJoin();
    expect(join).toEqual({
      id: expect.any(String),
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
      children: []
    });
  });

  it("creates a valid new join with populated data", () => {
    const join = createJoin({ sourceField: "someField" });
    expect(join).toEqual({
      id: expect.any(String),
      sourceLogrepo: null,
      sourceField: "someField",
      targetLogrepoName: null,
      targetLogrepoField: null,
      relationship: "1-to-1",
      eventOccurrence: {
        occurrence: "before",
        timeUnit: 1,
        timeScale: "days"
      },
      filter: null,
      children: []
    });
  });
});

describe("[Joins Parser] - createJoinFromBackendModel", () => {
  it("parses backend model to UI model", () => {
    const backendResponse = {
      parentField: "ParentLogrepoField",
      logrepoName: "ChildLogrepo",
      childField: "ChildLogrepoField",
      oneToOne: true,
      timeRangeStartBeforeHours: 5,
      timeRangeEndAfterHours: 0
    };

    expect(
      createJoinFromBackendModel(backendResponse, "ParentLogrepo")
    ).toEqual({
      id: expect.any(String),
      sourceLogrepo: "ParentLogrepo",
      sourceField: "ParentLogrepoField",
      targetLogrepoName: "ChildLogrepo",
      targetLogrepoField: "ChildLogrepoField",
      relationship: "1-to-1",
      eventOccurrence: {
        occurrence: "before",
        timeUnit: 5,
        timeScale: "hours"
      },
      filter: null,
      children: []
    });
  });

  it("turns non-multipliers of 24hs into hour format", () => {
    const backendResponse = {
      timeRangeStartBeforeHours: 25
    };

    const result = createJoinFromBackendModel(backendResponse);
    expect(result.eventOccurrence.timeScale).toBe("hours");
    expect(result.eventOccurrence.timeUnit).toBe(25);
  });

  it("turns multipliers of 24hs into hour format", () => {
    const backendResponse = {
      timeRangeStartBeforeHours: 48
    };

    const result = createJoinFromBackendModel(backendResponse);
    expect(result.eventOccurrence.timeScale).toBe("days");
    expect(result.eventOccurrence.timeUnit).toBe(2);
  });
});

describe("[Joins Parser] - createTreeStructureForJoins", () => {
  it("convers a plain array structure to a nested tree", () => {
    const joins = [
      createUiJoin("LogA", "LogB"),
      createUiJoin("LogB", "LogC"),
      createUiJoin("LogC", "LogD")
    ];

    const result = createTreeStructureForJoins(joins, "LogA");

    expect(result[0].sourceLogrepo).toBe("LogA");
    expect(result[0].targetLogrepoName).toBe("LogB");
    expect(result[1]).toBeUndefined();

    expect(result[0].children[0].sourceLogrepo).toBe("LogB");
    expect(result[0].children[0].targetLogrepoName).toBe("LogC");
    expect(result[0].children[1]).toBeUndefined();

    expect(result[0].children[0].children[0].sourceLogrepo).toBe("LogC");
    expect(result[0].children[0].children[0].targetLogrepoName).toBe("LogD");
    expect(result[0].children[0].children[1]).toBeUndefined();
  });
});

test("[Joins Parser] - parseFromAPI", () => {
  const joinsAPIResponse = [
    createAPIJoin("LogA", "LogB", [
      createAPIJoin("LogB", "LogC", [createAPIJoin("LogC", "LogD")])
    ]),
    createAPIJoin("LogA", "LogE")
  ];

  const result = parseFromAPI(joinsAPIResponse, "LogA");

  expect(result).toHaveLength(2);

  expect(result[0].sourceLogrepo).toEqual("LogA");
  expect(result[0].targetLogrepoName).toEqual("LogB");
  expect(result[0].children).toHaveLength(1);

  expect(result[0].children[0].sourceLogrepo).toEqual("LogB");
  expect(result[0].children[0].targetLogrepoName).toEqual("LogC");
  expect(result[0].children[0].children).toHaveLength(1);

  expect(result[0].children[0].children[0].sourceLogrepo).toEqual("LogC");
  expect(result[0].children[0].children[0].targetLogrepoName).toEqual("LogD");
  expect(result[0].children[0].children[0].children).toHaveLength(0);

  expect(result[1].sourceLogrepo).toEqual("LogA");
  expect(result[1].targetLogrepoName).toEqual("LogE");
});

test("[Joins Parser] - parseToAPI", () => {
  const uiJoins = [
    createUiJoin("LogA", "LogB", [
      createUiJoin("LogB", "LogC", [createUiJoin("LogC", "LogD", [])])
    ])
  ];

  const result = parseToAPI(uiJoins, "LogA");

  expect(result).toHaveLength(3);

  expect(result[0].parent).toBe("LogA");
  expect(result[0].logrepoName).toBe("LogB");

  expect(result[1].parent).toBe("LogB");
  expect(result[1].logrepoName).toBe("LogC");

  expect(result[2].parent).toBe("LogC");
  expect(result[2].logrepoName).toBe("LogD");
});
