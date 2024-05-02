<script lang="ts">
    let sourceBranch: string | null = null;
    let remoteOrigin: string | null = null;

    const handleBranchSubmit = () => {
        ts_vscode.postMessage({
            type: 'fetchCode',
            options: {
                sourceBranch: sourceBranch,
                remoteOrigin: remoteOrigin
            }
        });
    }

</script>

<style>
    input { 
        margin: 10px 0;
    }
</style>

<div>
    <input placeholder="Source branch - eg. main" id="sourceBranch" bind:value={sourceBranch} />
    <input placeholder="Remote origin name - eg. origin" id="remoteUrl" bind:value={remoteOrigin} />
    <button on:click={handleBranchSubmit}>Merge Conflicts</button>
</div>