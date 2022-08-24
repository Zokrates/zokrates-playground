import {
  Button,
  Code,
  Flex,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import Editor from "@monaco-editor/react";
import copy from "copy-to-clipboard";
import { readdir, readFile } from "fs/promises";
import { debounce } from "lodash";
import type { NextPage } from "next";
import { deflate, inflate } from "pako";
import { useEffect, useRef, useState } from "react";
import {
  BsFillPlayFill,
  BsGithub,
  BsQuestionCircleFill,
  BsShareFill,
} from "react-icons/bs";
import { metadata } from "zokrates-js";
import { zokratesLanguageConfig, zokratesTokensProvider } from "../syntax";

const MODEL_ID = "zokrates";

type HomeProps = {
  examples: {
    [key: string]: string;
  };
};

const Home: NextPage<HomeProps> = (props: HomeProps) => {
  const [examples, setExamples] = useState<any>(props.examples);
  const [worker, setWorker] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<any>(null);
  const [output, setOutput] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const editorRef = useRef<any>(null);
  const selectRef = useRef<any>(null);
  const toast = useToast();

  useEffect(() => {
    const worker = new Worker(new URL("../worker.js", import.meta.url));
    worker.onmessage = onWorkerMessage;
    setWorker(() => worker);

    if (!window.location.hash) {
      const defaultSource = localStorage.getItem("default-source");
      if (defaultSource) {
        let { source, timestamp } = JSON.parse(defaultSource);
        toast({
          description: `Restored from last session (${new Date(
            timestamp
          ).toLocaleString()})`,
          status: "info",
          duration: 3500,
          position: "top",
          isClosable: true,
        });
        setExamples((e: any) => Object.assign(e, { default: source }));
      }
    }

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
        value = examples["default"];
      }
    } catch (e) {
      console.error(e);
      value = examples["default"];
    }

    const model = monaco.editor.createModel(value, MODEL_ID);
    model.updateOptions({ insertSpaces: true, tabSize: 4 });
    editor.setModel(model);
    monaco.editor.setModelLanguage(model, MODEL_ID);
    editorRef.current = editor;
  };

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.register({ id: MODEL_ID });
    monaco.languages.setMonarchTokensProvider(MODEL_ID, zokratesTokensProvider);
    monaco.languages.setLanguageConfiguration(MODEL_ID, zokratesLanguageConfig);
  };

  const onEditorChange = debounce((value) => {
    if (window.location.hash) return;
    if (selectRef.current.value !== "default") return;
    localStorage.setItem(
      "default-source",
      JSON.stringify({ source: value, timestamp: Date.now() })
    );
  }, 250);

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
              disabled={!worker || !editorRef}
            >
              Compile
            </Button>
            <Select
              ref={selectRef}
              variant="filled"
              width="200px"
              defaultValue="default"
              onChange={(e) => {
                editorRef.current
                  .getModel()
                  .setValue(examples[e.currentTarget.value]);
              }}
            >
              {Object.keys(examples).map((key) => {
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
              disabled={!editorRef}
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
                    ZoKrates version: {metadata.version}
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
        <Flex
          grow={1}
          wrap="wrap"
          width="100%"
          border="1px"
          borderColor="gray.200"
        >
          <Flex grow={1} shrink={0} basis="20em" minW="536px">
            <Editor
              width="100%"
              options={{
                minimap: { enabled: false },
                hideCursorInOverviewRuler: true,
                fontSize: 18,
              }}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              onChange={onEditorChange}
            />
          </Flex>
          <Flex
            grow={1}
            shrink={0}
            basis="20em"
            borderLeft="1px"
            borderColor="gray.200"
            minH="536px"
          >
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
                      whiteSpace="pre-wrap"
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
