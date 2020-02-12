import typeDetect from 'type-detect'
import Ajv, { ErrorObject } from 'ajv'
import jsonSchemaDraft4 from 'ajv/lib/refs/json-schema-draft-04.json'
import { SvelteComponent } from 'svelte'

import {
  FieldProps,
  JSONObject,
  JSONSchema,
  JSONSchemaType,
  JSONSchemaTypeName,
  ErrorRecord,
  Errors,
  FormComponents,
  Props,
  PathComponents
} from './types'

export function createProps<T extends JSONSchemaType, E extends Errors = ErrorObject[]>(
  value: T | null = null
): FieldProps<T, E> {
  const props: FieldProps<T, E> = {
    value,
    errors: null
  }

  return props
}

export function objectDefaultValue(schema: JSONSchema, value: JSONObject | null): JSONObject {
  const v: JSONObject = {}
  const { properties } = schema
  if (properties) {
    for (let k in properties) {
      const propSchema = properties[k]

      if (typeof propSchema !== 'boolean') {
        const item = value && value[k]
        v[k] = defaultValue(propSchema, item)
      }
    }
  }
  return v
}

export function defaultValue(schema: JSONSchema, value: JSONSchemaType): JSONSchemaType {
  if (value === null && schema.default !== undefined) {
    value = schema.default
  }

  switch (schema.type) {
    case 'object':
      return objectDefaultValue(schema, <JSONObject>value)

    case 'array':
      return value || []
  }

  return value
}

export function normalizeObject(value: JSONObject, isRoot = true): JSONObject | null {
  const obj: JSONObject = {}
  for (const k in value) {
    let v = value[k]
    v = typeDetect(v) === 'Object' ? normalizeObject(v as JSONObject, false) : v
    if (v !== null) {
      obj[k] = v
    }
  }
  return Object.keys(obj).length ? obj : isRoot ? {} : null
}

export function normalizeValue(value: JSONSchemaType): JSONSchemaType {
  return typeDetect(value) === 'Object' ? normalizeObject(value as JSONObject) : value
}

let ajv: Ajv.Ajv
export const options = {
  get ajv() {
    if (!ajv) {
      ajv = new Ajv({ schemaId: 'auto', allErrors: true })
      ajv.addMetaSchema(jsonSchemaDraft4)
    }
    return ajv
  }
}
export function validate(ajv: Ajv.Ajv, schema: JSONSchema, data: JSONSchemaType) {
  const valid = ajv.validate(schema, data) as boolean
  if (!valid) {
    return ajv.errors as Ajv.ErrorObject[]
  }
  return null
}

export function errorsToMap(errors: ErrorObject[]): ErrorRecord {
  const errorMap: ErrorRecord = {}
  return errors
    .map(
      (error): [string[], ErrorObject] => {
        const pathSuffix =
          error.keyword === 'required'
            ? `.${(<Ajv.RequiredParams>error.params).missingProperty}`
            : ''
        const path = `${error.dataPath}${pathSuffix}`.split('.').slice(1)
        return [path, error]
      }
    )
    .reduce((acc, [path, error]) => {
      path.reduce((obj, key, i, arr) => {
        // build tree
        if (i !== arr.length - 1) {
          return (obj[key] ? obj[key] : (obj[key] = obj[key] || {})) as ErrorRecord
        }

        // add error
        if (obj[key]) {
          ;(obj[key] as ErrorObject[]).push(error)
        } else {
          obj[key] = [error]
        }

        return obj
      }, acc)
      return acc
    }, errorMap)
}

export function repackComponents(
  components: FormComponents,
  type: JSONSchemaTypeName,
  key: string
): FormComponents {
  if (type === 'object') {
    if (components.path) {
      const path = components.path[key] as PathComponents
      return { ...components, path }
    }
  }

  return components
}

export function getComponent(
  components: FormComponents,
  type: JSONSchemaTypeName,
  key: string
): typeof SvelteComponent {
  if (type === 'object') {
    const pathComponent = components.path && components.path[key]
    if (pathComponent) {
      if (Array.isArray(pathComponent)) {
        return pathComponent[0] as typeof SvelteComponent
      }
      return pathComponent as typeof SvelteComponent
    }
  }

  return components[type]
}

export function getComponentProps(
  components: FormComponents,
  type: JSONSchemaTypeName,
  key: string
): Props {
  if (type === 'object') {
    const pathComponent = components.path && components.path[key]
    if (pathComponent && Array.isArray(pathComponent)) {
      return pathComponent[1] as Props
    }
  }

  return {}
}
