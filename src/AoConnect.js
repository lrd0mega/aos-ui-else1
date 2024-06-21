const { connect, createDataItemSigner } = require('@permaweb/aoconnect');

const MU_URL = "https://mu.ao-testnet.xyz";
const CU_URL = "https://cu.ao-testnet.xyz";
// const GATEWAY_URL = "https://arweave.net";
const GATEWAY_URL = "https://ar-io.net/";
const DEFAULT_MODULE = "1PdCJiXhNafpJbvC-sjxWTeNzbf9Q_RfUNs84GYoPm0";
const DEFAULT_SCHEDULER = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA";

//https://g8way.io/graphql
const AoQueryProcesses = async (address, name='') => {
    const headers = {
        'Content-Type': 'application/json',
    };

    let processList = [];
    let afterCursor = null;

    while (true) {
        const jsonData = {
            variables: {
                addresses: [`${address}`],
                first: 100,
                after: afterCursor
            },
            query: `query ($addresses:[String!]!, $first: Int!, $after: String) {
                transactions (
                    first: $first,
                    after: $after,
                    owners: $addresses, 
                    tags: [
                        { name: "Data-Protocol", values: ["ao"] },
                        { name: "Variant", values: ["ao.TN.1"] },
                        { name: "Type", values: ["Process"]},
                        { name: "Name", values: ["${name}"]}
                    ]
                ) {
                    edges {
                        node {
                            id
                            tags {
                                name
                                value
                            }
                            
                        }
                        cursor
                    }
                }
            }`
        };

        const response = await fetch('https://arweave-search.goldsky.com/graphql', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(jsonData)
        });

        const result = await response.json();
        // console.log(jsonData);
        // console.log(result);

        // 检查是否有数据
        if (result.data.transactions.edges.length === 0) {
            break;
        }

        // 处理当前页的数据
        for (const info of result.data.transactions.edges) {

            const processInfo = info.node.tags.reduce((obj, item) => {
                obj[item.name] = item.value;
                return obj;
            }, {});
            processInfo.id = info.node.id
            processList.push(processInfo);
        }

        afterCursor = result.data.transactions.edges[result.data.transactions.edges.length - 1].cursor;
    }

    return processList;
}

const evaluate = async (pid, data) => {
    const messageId = await connect().message({
        process: pid,
        signer: createDataItemSigner(globalThis.Wallet || globalThis.arweaveWallet),
        tags: [{ name: 'Action', value: 'Eval' }],
        data
    })
    const result = await connect().result({
        message: messageId,
        process: pid
    })
    //console.log(result)
    if (result.Error) {
        throw new Error(JSON.stringify(result.Error))
    }

    if (result.Output?.data?.prompt) {
        // prompt.set(result.Output?.data?.prompt)
    }
    if (result.Output?.data?.output) {
        return result.Output?.data?.output
    }

    return undefined

}

const AoCreateProcess = async (currentWalletJwk, moduleTxId=DEFAULT_MODULE, scheduler=DEFAULT_SCHEDULER, Tags) => {
    const { spawn } = connect({ MU_URL, CU_URL, GATEWAY_URL });

    const processTxId = await spawn({
        module: moduleTxId,
        scheduler: scheduler,
        signer: createDataItemSigner(currentWalletJwk),
        tags: Tags,
    });

    console.log("AoCreateProcess processTxId", processTxId);

    return processTxId;
};

export default {
    AoCreateProcess,
    AoQueryProcesses,
    evaluate,

    GATEWAY_URL,
};
