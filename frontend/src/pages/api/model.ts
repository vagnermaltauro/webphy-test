import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'URL is required' });
    }

    try {
        const modelResponse = await fetch(url);
        if (!modelResponse.ok) {
            throw new Error(`Failed to fetch: ${modelResponse.statusText}`);
        }

        const modelData = await modelResponse.arrayBuffer();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        // indica pro navegador que é arquivo binário
        res.setHeader('Content-Type', 'application/octet-stream');

        // Envia como Buffer
        res.send(Buffer.from(modelData));
    } catch (error) {
        console.error('Error fetching model:', error);
        res.status(500).json({ message: 'Failed to fetch model', error: String(error) });
    }
}

export const config = {
    api: {
        bodyParser: false, // Deve ser false para binário
        responseLimit: '50mb',
    },
};
