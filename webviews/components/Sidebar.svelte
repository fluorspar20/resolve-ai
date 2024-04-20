<script lang="ts">
    let sourceBranch: string | null = null;
    let remoteUrl: string | null = null;

    const handleBranchSubmit = () => {
        // @todo - fetch this branch using the remote url
        ts_vscode.postMessage({
            type: 'fetchCode',
            options: {
                sourceBranch: sourceBranch,
                remoteUrl: remoteUrl
            }
        })
        
        // @todo - display files in webview -> at a later stage - display conflicted files only
    }

</script>

<style>
    input { 
        margin: 10px 0;
    }
</style>

<div>
    <input placeholder="Source Branch - eg. main" id="sourceBranch" bind:value={sourceBranch} />
    <input placeholder="Remote URL" id="remoteUrl" bind:value={remoteUrl} />
    <button on:click={handleBranchSubmit}>Submit</button>
</div>