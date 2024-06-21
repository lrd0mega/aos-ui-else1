import React, { useState, useRef, useEffect,useLayoutEffect, Fragment } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import ProTip from './ProTip';

// ** React Imports

// ** MUI Imports
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'

import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import { ConnectButton, useActiveAddress, ArweaveWalletKit } from "arweave-wallet-kit";
import { connect, createDataItemSigner } from '@permaweb/aoconnect'
import AoConnect from './AoConnect.js'
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Readline } from "xterm-readline";
import 'xterm/css/xterm.css';



import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

function Copyright() {
  return (
    <Typography variant="body2" color="text.secondary" align="center">
      {'Copyright © '}
      <Link color="inherit" href="https://mui.com/">
        Your Website
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

export default function App() {
    const [processName, setProcessName] = useState("default")
    const [connecting, setConnecting] = useState(false)
    const [connectProcessId, setConnectProcessId] = useState("")
    const [contentedAddress, setContentedAddress] = useState("")
    const [loadText, setLoadText] = useState("")



    const activeAddress = useActiveAddress();

    useEffect(() => {
        queryAllProcesses(activeAddress);
        setContentedAddress(activeAddress)
    }, [activeAddress]);

    const spawnProcess = () => {
        if (window.arweaveWallet && processName) {
            outPutMsg(`Create ${processName} Process ...`, false)
            const tags = [
                { name: "App-Name", value: "aos" },
                { name: "aos-Version", value: "1.10.30" },
                { name: "Name", value: processName },
            ];
            AoConnect.AoCreateProcess(window.arweaveWallet, AoConnect.DEFAULT_MODULE, AoConnect.DEFAULT_SCHEDULER, tags).then(processId => {
                setConnectProcessId(processId)
                doLive(processId);
                outPutMsg(`create success, connect success pid：${processId}`)
                setConnecting(false)
            });
        }
    };

    const queryAllProcesses = (address) => {
        if (address && contentedAddress === address) {
            if (processName.length === 43) {
                const processId = processName
                setConnectProcessId(processId)
                doLive(processId);
            } else {
                AoConnect.AoQueryProcesses(address, processName).then(processInfoList => {
                    console.info(processInfoList)
                    if (processInfoList && processInfoList.length>0){
                        const processId = processInfoList[0].id
                        setConnectProcessId(processId)
                        doLive(processId);
                        outPutMsg(`connect success pid：${processId}`)
                        setConnecting(false)
                    } else {
                        //创建进程
                        spawnProcess()
                    }
                })
            }
        }
    }

    const createOrConnect = () => {
        if (activeAddress) {
            outPutMsg(`Connect Process ...`, false)
            setConnecting(true)
            queryAllProcesses(activeAddress)
        } else {
            outPutMsg(`Connect Wallet First`, true)
        }

    }

    const handleProcessNameChange = (event) => {
        setProcessName(event.target.value);
    };


    const terminalRef = useRef(null);
    const [xterm, setXterm] = useState(null)
    const [outLine, setOutLine] = useState(null)
    const [showEditor, setShowEditor] = useState(false)

    useLayoutEffect(() => {
        const fitAddon = new FitAddon();
        // const terminal = new Terminal({
        //     theme: {
        //         background: "#FFF",
        //         foreground: "#191A19",
        //         selectionForeground: "#FFF",
        //         selectionBackground: "#191A19",
        //
        //         cursor: "black",
        //     },
        //     cursorBlink: true,
        //     cursorStyle: "block",
        // });
        const terminal = new Terminal();
        setXterm(terminal)
        const rl = new Readline();


        // Attach the terminal to the DOM
        terminal.loadAddon(rl);
        terminal.loadAddon(fitAddon);
        terminal.open(terminalRef.current);
        fitAddon.fit();
        // terminal.resize(terminal.cols, 240);
        terminal.focus();
        terminal.writeln("Welcome to aos" + "\r\n");

        rl.setCheckHandler((text) => {
            let trimmedText = text.trimEnd();
            if (trimmedText.endsWith("&&")) {
                return false;
            }
            return true;
        });
        setOutLine(rl)

        return () => {
            terminal.dispose();
        };
    }, []);

    useEffect(() => {
        if (outLine) {
            outLine.read("aos> ").then(processLine);
        }
    }, [outLine, connectProcessId]);

    useEffect(() => {
        if (loadText) {
            doLoad()
        }
    }, [loadText]);

    function readLine() {
        if (outLine) {
            outLine.read("aos> ").then(processLine);
        }
    }

    function outPutMsg(msg, withAos=true) {
        xterm.writeln(`\r${msg}`);
        if(withAos) {
            xterm.write("aos> ");
        }
    }

    async function processLine(text) {
        if (text.trim().length === 0) {
            setTimeout(readLine);
            return;
        }
        const loadBlueprintExp = /\.load-blueprint\s+(\w*)/;
        if (loadBlueprintExp.test(text)) {
            const bpName = text.match(/\.load-blueprint\s+(\w*)/)[1];
            text = await loadBlueprint(bpName);
            outLine.println("loading " + bpName + "...");
        }
        const loadExp = /\.load/;
        if (loadExp.test(text)) {
            setShowEditor(true);
            return;
        }
        if (/\.editor/.test(text)) {
            setShowEditor(true);
            return;
        }
        if (connectProcessId.length === 43) {
            // evaluate
            try {
                // outLine.println("processing request...");
                const result = await AoConnect.evaluate(connectProcessId, text);
                outLine.println(result);
            } catch (e) {
                xterm.writeln("ERROR: " + e.message);
            }
        } else {
            console.info("connectProcessId", connectProcessId)
            xterm.writeln("Connect to a process to get started.");
        }
        // outLine.println("Connect to a process to get started.");
        // xterm.writeln("Connect to a process to get ");
        setTimeout(readLine);
    }

    async function loadBlueprint(name) {
        const data = await fetch(`https://raw.githubusercontent.com/permaweb/aos/main/blueprints/${name}.lua`)
            .then(res => {
                if (res.status === 200) {
                    return res.text()
                }
                throw new Error("blueprint not found")
            })
        return data
    }

    async function doLoad() {
        try {
            if (connectProcessId && loadText) {
                outLine.println("load code...");
                const result = await AoConnect.evaluate(connectProcessId, loadText);
                outLine.println(result);
                setLoadText("")
                setShowEditor(false)
                setTimeout(readLine);
            }
        } catch (e) {

        }
    }


    const handleClickOpen = () => {
        setShowEditor(true);
    };

    const handleClose = () => {
        setShowEditor(false);
    };

    //=================================================
    const [cursor, setCursor] = useState("")
    const [liveMsg, setLiveMsg] = useState(null)
    async function live(pid) {
        let results = await connect().results({
            process: pid,
            sort: "DESC",
            from: cursor || "",
            limit: 1
        });
        const xnode = results.edges.filter(
            x => x.node.Output.print === true
        )[0]
        if (xnode) {
            setCursor(xnode.cursor)
            //console.log(xnode.node.Output.data)
            return xnode.node.Output.data
        }
        return null
    }

    async function doLive(pid) {
        console.info("doLive")
        const getLiveUpdates = async () => {
            // if (pid !== connectProcessId){
            //     console.info("pid !== connectProcessId return",pid,connectProcessId)
            //     return
            // }
            const msg = await live(pid);
            if (msg !== null && msg !== liveMsg) {
                setLiveMsg(msg);
            }
            setTimeout(getLiveUpdates, 5000);
        };

        // turn on live update
        setTimeout(getLiveUpdates, 500);
    }

    useEffect(() => {
        if (liveMsg) {
            if (liveMsg) {
                liveMsg.split("\n").forEach((m) => xterm.writeln("\r" + m));
                xterm.write("aos> ");
            }
        }
    }, [liveMsg]);

    return (
            <Grid container spacing={6}>
                <Grid item xs={12}>
                    <Card sx={{ padding: '0 8px' }}>
                        <Fragment>
                            <Card>

                                <CardHeader title="" />
                                <ConnectButton style={{ margin: '0 20px', float: 'right' }}
                                               showBalance={true}
                                />
                                <CardContent>
                                    <Grid container spacing={5}>
                                        <Grid item xs={12}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs>
                                                    <TextField
                                                        fullWidth
                                                        label=""
                                                        placeholder="Process Name"
                                                        value={processName}
                                                        onChange={handleProcessNameChange}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position='start'>
                                                                    {/* <Icon icon='mdi:account-outline' /> */}
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                        error={false}
                                                    />
                                                </Grid>
                                                <Grid item spacing={2}>
                                                    <Button
                                                        type='submit'
                                                        variant='contained'
                                                        size='large'
                                                        onClick={createOrConnect}
                                                        disabled={!processName || connecting}
                                                        sx={{ height: '100%' }}
                                                    >
                                                        Create or Connect
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>

                        </Fragment>
                    </Card>
                    <Grid item xs={12}>
                        <Card sx={{ padding: 2 }}>
                            <CardContent>
                                <div className="flex h-screen w-full">
                                    {/*<div id="terminal" className="mx-8 w-90% h-screen"></div>*/}
                                    <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
                                </div>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Button variant="outlined" onClick={handleClickOpen}>
                        Load Lua Code
                    </Button>
                    <Dialog
                        open={showEditor}
                        onClose={handleClose}
                        PaperProps={{
                            component: 'form',
                            onSubmit: (event) => {
                                event.preventDefault();
                                const formData = new FormData(event.currentTarget);
                                const formJson = Object.fromEntries((formData).entries());
                                const text = formJson.text;
                                console.log(text);
                                setLoadText(text)
                                handleClose();
                            },
                        }}
                        fullWidth
                    >
                        <DialogTitle>Lua Code Editor</DialogTitle>
                        <DialogContent>
                            {/*<DialogContentText>*/}
                            {/*    */}
                            {/*</DialogContentText>*/}
                            <TextField
                                autoFocus
                                required
                                margin="dense"
                                id="name"
                                name="text"
                                label="Enter Lua Code into process..."
                                variant="standard"
                                multiline
                                rows={6} // 你可以根据需要调整行数
                                fullWidth
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleClose}>Cancel</Button>
                            <Button type="submit">Load</Button>
                        </DialogActions>
                    </Dialog>

                </Grid>

            </Grid>

    );

}
