import {
  Box,
  Button,
  Code,
  Flex,
  HStack,
  IconButton,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
  VStack,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverCloseButton,
  PopoverBody,
  PopoverHeader,
  PopoverArrow,
} from "@chakra-ui/react";
import Editor from "@monaco-editor/react";
import copy from "copy-to-clipboard";
import type { NextPage } from "next";
import { deflate, inflate } from "pako";
import { useEffect, useRef, useState } from "react";
import {
  BsFillPlayFill,
  BsGithub,
  BsShareFill,
  BsQuestionCircleFill,
} from "react-icons/bs";
import { metadata } from "zokrates-js";
import { zokratesLanguageConfig, zokratesTokensProvider } from "../syntax";
import { readdir, readFile } from "fs/promises";

const MODEL = "zokrates";

type HomeProps = {
  examples: {
    [key: string]: string;
  };
};

const Home: NextPage<HomeProps> = (props: HomeProps) => {
  const [worker, setWorker] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<any>({});
  const [output, setOutput] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const editorRef = useRef<any>(null);
  const toast = useToast();

  useEffect(() => {
    const worker = new Worker(new URL("../worker.js", import.meta.url));
    worker.onmessage = onWorkerMessage;
    setWorker(worker);
    return () => worker.terminate();
  }, []);

  const postMessage = (type: string, payload: any) => {
    worker.postMessage({ type, payload });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    let value;
    try {
      if (window.location.hash) {
        const encoded: string = window.location.hash.replace(/^#/, "");
        const compressed = Buffer.from(encoded, "base64");
        value = Buffer.from(inflate(compressed)).toString();
      } else {
        value = props.examples["default"];
      }
    } catch (e) {
      console.error(e);
      value = props.examples["default"];
    }

    const model = monaco.editor.createModel(value, MODEL);
    model.updateOptions({ insertSpaces: true, tabSize: 4 });
    editor.setModel(model);
    monaco.editor.setModelLanguage(model, MODEL);
    editorRef.current = editor;
  };

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.register({ id: MODEL });
    monaco.languages.setMonarchTokensProvider(MODEL, zokratesTokensProvider);
    monaco.languages.setLanguageConfiguration(MODEL, zokratesLanguageConfig);
  };

  const onCompile = () => {
    const source = editorRef.current.getValue();
    setIsLoading(true);
    setTimeout(() => postMessage("compile", source), 100);
  };

  const onShare = () => {
    const source = editorRef.current.getValue();
    const buffer = Buffer.from(source);
    const compressed = Buffer.from(deflate(buffer)).toString("base64");
    if (copy(window.location.origin + `/#${compressed}`)) {
      toast({
        title: "Share away!",
        description: "A direct link has been copied to the clipboard",
        status: "success",
        duration: 3000,
        position: "top",
        isClosable: true,
      });
    }
  };

  const onWorkerMessage = (event: any) => {
    setIsLoading(false);
    const message = event.data;
    switch (message.type) {
      case "compile": {
        setArtifacts(message.payload);
        setOutput({
          type: "success",
          message: `Compilation successful (took ${(
            message.span.end - message.span.start
          ).toFixed(2)} ms) ✔️`,
          timestamp: new Date().toISOString(),
        });
        break;
      }
      case "error": {
        console.error(message.payload.error);
        setOutput({
          type: "error",
          message: message.payload.error,
          timestamp: new Date().toISOString(),
        });
        break;
      }
      default:
        break;
    }
  };

  return (
    <Flex as="main" minHeight="100vh">
      <VStack width="100%">
        <Flex p={4} width="100%" justifyContent="space-between">
          <HStack spacing="12px">
            <Button
              leftIcon={<BsFillPlayFill />}
              colorScheme="blue"
              variant="solid"
              onClick={onCompile}
              isLoading={isLoading}
              loadingText="Compiling"
            >
              Compile
            </Button>
            <Select
              variant="filled"
              width="200px"
              defaultValue="default"
              onChange={(e) => {
                editorRef.current
                  .getModel()
                  .setValue(props.examples[e.currentTarget.value]);
              }}
            >
              {Object.keys(props.examples).map((key) => {
                return <option key={key}>{key}</option>;
              })}
            </Select>
          </HStack>
          <HStack spacing="12px">
            <IconButton
              aria-label="Share"
              size="lg"
              isRound={true}
              icon={<BsShareFill />}
              onClick={onShare}
            />
            <Popover isLazy placement="bottom-end">
              {/* @ts-ignore */}
              <PopoverTrigger>
                <IconButton
                  aria-label="Help"
                  size="lg"
                  isRound={true}
                  icon={<BsQuestionCircleFill />}
                />
              </PopoverTrigger>
              <PopoverContent>
                <PopoverArrow />
                <PopoverCloseButton />
                <PopoverHeader fontWeight="semibold">
                  What is ZoKrates?
                </PopoverHeader>
                <PopoverBody p={0}>
                  <Text p={4}>
                    ZoKrates is a toolbox for zkSNARKs on Ethereum. It helps you
                    use verifiable computation in your DApp, from the
                    specification of your program in a high level language to
                    generating proofs of computation to verifying those proofs
                    in Solidity.
                  </Text>
                  <Text fontSize="sm" p={4} bg="gray.100" color="gray.600">
                    ZoKrates Playground version: {metadata.version}
                  </Text>
                </PopoverBody>
              </PopoverContent>
            </Popover>
            <IconButton
              aria-label="Github"
              size="lg"
              isRound={true}
              icon={<BsGithub />}
              as="a"
              href="https://github.com/Zokrates/ZoKrates"
              target="_blank"
            />
          </HStack>
        </Flex>
        <Flex grow={1} width="100%" border="1px" borderColor="gray.200">
          <Flex flex={1} minW="568px">
            <Editor
              width="100%"
              options={{
                minimap: { enabled: false },
                hideCursorInOverviewRuler: true,
                fontSize: 18,
              }}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
            />
          </Flex>
          <Flex flex={1} borderLeft="1px" borderColor="gray.200">
            <Tabs width="100%">
              <TabList>
                <Tab>Output</Tab>
                <Tab>Abi</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  {output && (
                    <Code
                      display="block"
                      whiteSpace="pre"
                      bg="white"
                      color={output.type == "error" ? "red" : "green"}
                    >
                      [{output.timestamp}] {output.message}
                    </Code>
                  )}
                </TabPanel>
                <TabPanel>
                  {artifacts && (
                    <Code display="block" whiteSpace="pre" bg="white">
                      {JSON.stringify(artifacts.abi, null, 2)}
                    </Code>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Flex>
        </Flex>
      </VStack>
    </Flex>
  );
};

export async function getStaticProps() {
  let root = "src/examples/";
  let files = (await readdir(root)).sort((a, b) => a.localeCompare(b));
  let examples: any = {};

  for (let file of files) {
    let name = file.split(".")[0].replace(/^_/, "");
    examples[name] = (await readFile(root + file)).toString();
  }

  return {
    props: { examples },
  };
}

export default Home;
