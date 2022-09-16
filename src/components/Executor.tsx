import {
  Box,
  Button,
  Code,
  FormControl,
  FormLabel,
  Input,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import jsonschema, { Schema } from "jsonschema";
import { FormEvent, useEffect, useState } from "react";
import { BsFillPlayFill } from "react-icons/bs";
import { CompilationArtifacts } from "zokrates-js";
import { ZoKratesWorker } from "./ZoKratesWorker";

type ExecutorProps = {
  worker: ZoKratesWorker;
  artifacts: CompilationArtifacts;
};

type InputComponent = {
  component: any;
  value: string;
  validator: (value: string) => boolean;
  transformedValue?: any;
};

type InputState = {
  [key: string]: InputComponent;
};

type OutputState = {
  type: string;
  message: string;
  timestamp: string;
  logs?: string[];
} | null;

const createValidationSchema = (component: any): Schema => {
  switch (component.type) {
    case "field": {
      return {
        type: "string",
        pattern: /^\d+$/,
        required: true,
      };
    }
    case "u8": {
      return {
        type: "string",
        pattern: new RegExp(`^(\\d+|0x[0-9a-fA-F]{1,2})$`),
        required: true,
      };
    }
    case "u16": {
      return {
        type: "string",
        pattern: new RegExp(`^(\\d+|0x[0-9a-fA-F]{1,4})$`),
        required: true,
      };
    }
    case "u32": {
      return {
        type: "string",
        pattern: new RegExp(`^(\\d+|0x[0-9a-fA-F]{1,8})$`),
        required: true,
      };
    }
    case "u64": {
      return {
        type: "string",
        pattern: new RegExp(`^(\\d+|0x[0-9a-fA-F]{1,16})$`),
        required: true,
      };
    }
    case "bool": {
      return {
        type: "boolean",
        required: true,
      };
    }
    case "tuple":
      return {
        type: "array",
        minItems: component.components.elements.length,
        maxItems: component.components.elements.length,
        items: component.components.elements.map((e: any) =>
          createValidationSchema(e)
        ),
        required: true,
      };
    case "array": {
      return {
        type: "array",
        minItems: component.components.size,
        maxItems: component.components.size,
        items: createValidationSchema(component.components),
        required: true,
      };
    }
    case "struct": {
      return {
        type: "object",
        properties: component.components.members.reduce(
          (result: any, component: any) => {
            result[component.name] = createValidationSchema(component);
            return result;
          },
          {}
        ),
        required: true,
      };
    }
    default:
      throw new Error("Unrecognized component type");
  }
};

const fromJson = (input: string) => {
  try {
    return JSON.parse(input);
  } catch (_) {
    return input;
  }
};

const createValidator = (component: any) => {
  return (value: string) => {
    const result = jsonschema.validate(
      value,
      createValidationSchema(component)
    );
    return result;
  };
};

const Executor = (props: ExecutorProps) => {
  const abi = props.artifacts.abi;
  const [inputs, setInputs] = useState<InputState>({});
  const [output, setOutput] = useState<OutputState>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onWorkerMessage = (event: any) => {
    setIsLoading(false);
    const message = event.data;
    switch (message.type) {
      case "compute": {
        setOutput({
          type: "success",
          logs: message.payload.logs,
          message: `Program returned: ${message.payload.output} (took ${(
            message.span.end - message.span.start
          ).toFixed(2)} ms) ✔️`,
          timestamp: new Date().toISOString(),
        });
        break;
      }
      case "error": {
        if (message.payload.type !== "compute") return;
        console.error(message.payload.error);
        setOutput({
          type: "error",
          message: message.payload.error,
          timestamp: new Date().toISOString(),
        });
      }
      default:
        break;
    }
  };

  useEffect(() => {
    setOutput(null);
    setInputs(() =>
      abi.inputs.reduce(
        (prev, component) => ({
          ...prev,
          [component.name]: {
            component,
            value: "",
            validator: createValidator(component),
          },
        }),
        {}
      )
    );
    const subscription = props.worker.onMessage().subscribe(onWorkerMessage);
    return () => subscription.unsubscribe();
  }, [abi]);

  const onInputChange = (key: string, value: string) =>
    setInputs({
      ...inputs,
      [key]: { ...inputs[key], value, transformedValue: fromJson(value) },
    });

  const getTransformedValue = (i: InputComponent) => {
    if (/u\d+|field/.test(i.component.type)) {
      return i.value;
    }
    return i.transformedValue;
  };

  const onExecute = (e: FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOutput(null);
    setIsLoading(true);

    setTimeout(() => {
      const payload = {
        artifacts: props.artifacts,
        args: Object.values(inputs).map((i: InputComponent) =>
          getTransformedValue(i)
        ),
      };
      props.worker.postMessage("compute", payload);
    }, 100);
  };

  return (
    <VStack
      spacing={4}
      alignItems="flex-start"
      as="form"
      onSubmit={onExecute}
      minW={"200px"}
    >
      {Object.entries(inputs).map(([key, input]: [string, any]) => {
        const validationResult = input.validator(getTransformedValue(input));
        const isInvalid = input.value != "" && !validationResult.valid;
        return (
          <FormControl key={key} isInvalid={isInvalid}>
            <FormLabel>
              <Text fontWeight="bold" as="span">
                {key}
              </Text>
              : {input.component.type}
            </FormLabel>
            <Tooltip
              hasArrow
              label={validationResult.toString()}
              bg="red.600"
              isDisabled={!isInvalid}
              as="pre"
              whiteSpace="pre-wrap"
            >
              <Input
                type="text"
                value={input.value}
                onChange={(e) => onInputChange(key, e.target.value)}
                required={true}
                fontFamily="monospace"
              />
            </Tooltip>
          </FormControl>
        );
      })}
      <Button
        type="submit"
        leftIcon={<BsFillPlayFill />}
        isLoading={isLoading}
        loadingText="Running..."
      >
        Run
      </Button>
      {output && (
        <Code display="block" whiteSpace="pre-wrap" bg="white">
          {output.logs && (
            <Box mb={2}>
              {output.logs.map((log: string) => `[LOG] ${log}\n`)}
            </Box>
          )}
          <Box color={output.type == "error" ? "red" : "green"}>
            {output.message}
          </Box>
        </Code>
      )}
    </VStack>
  );
};

export { Executor };
