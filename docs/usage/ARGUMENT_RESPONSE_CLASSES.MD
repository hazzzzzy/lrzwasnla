## Creating Service Function Argument and Response Classes

Service function argument or response class can contain one or more properties.
Compared to e.g. REST technology, service function argument/response classes or the same as Data Transfer Objects (DTOs).

Possible sservice function argument/response class property types are:
- `number`
- `boolean`
- `string`
- `Date`
- number or string union type, for example: `1 | 5 | 10` or `'forSale' | 'sold'`
- another entity type
- Arrays of above types

If your Service function argument or response class does not have a constructor, you need to define properties with
an exclamation mark (!), because otherwise a TypeScript error is generated.

Example use of the exclamation mark:
```ts
class MyServiceFunctionArg {
  someValue!: string;
}
```

Any property can be optional:
```ts
class MyServiceFunctionArg {
  someOptionalValue?: string;
}
```

Number type properties must be annotated with one of following decorators, or otherwise an exception will be thrown:
- `IsInt()`
- `IsFloat()`
- `IsBigInt()`

String type properties must be annotated with one of the string validators or with `IsAnyString()` decorator, otherwise an exception will be thrown.
String validation decorators are listed [here.](../api/DECORATORS.MD#validation-decorators)

The possible value range of number type properties must be validated with following decorators, or otherwise an exception will be thrown:
- `@Min()` and `@Max()`
- `@MinMax()`

The maximum length of string type properties must be validated with following decorators, or otherwise an exception will be thrown:
- `@MaxLength()`
- `@Length()`

Each array type property must have the following decorators, or otherwise an exception will be thrown:
- `@ArrayMinSize()`
- `@ArrayMaxSize()`

You can document class property by writing a comment above it:

```ts
class MyClass {
  /* this is an example of property documentation */
  myProperty!: string;

  // this is an example of property documentation
  myProperty2!: string;
}
```

### Defining a Service Function Argument/Response Class with Property Composition
You can make a service function argument or response class by composing its properties of one or more properties of another (source) class or classes (e.g. entity class).
In this way, it is simpler to define the argument/response classes. 
If the source class(es) change, also the composed class will change automatically.
To take advantage of this feature, you need to declare the class in special `.type` file.

Below is an example of composing `PayOrderArg` service function argument class of some properties of `Order` entity class:

PayOrderArg.type

```ts
class PayOrderArg {
...NonNullable<Pick<Order, '_id' | 'paymentGateway' | 'transactionId' | 'transactionTimestamp' | 'paymentAmount'>>;
}
```

In the above example, `PayOrderArg` class is composed by picking following properties from `Order` class and making then non-nullable:
- `_id`
- `paymentGateway`
- `transactionId`
- `transactionTimestamp`
- `paymentAmount`

You need to generate the `.ts` files from `.type` files by executing following command:

```bash
npm run generateTypes
```

If your .type file(s) have changed or some of the files that .type file references have changed, and
you try to start the microservice in dev environment (`npm run start:dev`), you will get an error where it is instructed that `npm run generateTypes`
must be run to re-generate types before trying to start the microservice.

Possible operations for class property composition:

| Operation                                                                                  | Description                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| <code>...Pick<OtherClass, 'propertyName1' &#124; 'propertyName2' ...>;</code>              | Picks the listed properties from `OtherClass`                            |
| <code>...Omit<OtherClass, 'propertyName1' &#124; 'propertyName2' ...>;</code>              | Picks all except the listed properties from `OtherClass`                 |
| <code>...OtherClass;</code>                                                                | Picks all properties from `OtherClass`                                   |
| <code>...NonNullable<Pick<OtherClass, 'propertyName1' &#124; 'propertyName2' ...>>;</code> | Picks the listed properties from `OtherClass` and makes the non-nullable |
| <code>...Partial<Pick<OtherClass, 'propertyName1' &#124; 'propertyName2' ...>>;</code>     | Picks the listed properties from `OtherClass` and makes them optional    |
