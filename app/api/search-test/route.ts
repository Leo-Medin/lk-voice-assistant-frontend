
import { NextRequest, NextResponse } from "next/server";
import axios from 'axios';

// don't cache the results
export const revalidate = 0;


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return new NextResponse('No query provided', { status: 500 });
  }
  console.log('query:', query);

  let resultData;

  try {

    // const response = await axios.get(`https://api.search.brave.com/res/v1/web/search/`, {
    //   params: {
    //     q: query,
    //     summary: "1"
    //   },
    //   headers: {
    //     "X-Subscription-Token": process.env.BRAVE_API_KEY as string,
    //     // "Accept": "application/json"
    //   }
    // });
    // console.log('response.data:', response.data);
    // // console.log('response:', response);

    // const response = await fetch(`https://api.search.brave.com/res/v1/web/search/?q=${query}&summary=1`, {
    //   headers: {
    //     "X-Subscription-Token": process.env.BRAVE_API_KEY as string      
    //   },
    // })
    // .then(response => response.json())
    // .then((result) => {
    //   console.log('after fetch result:', result);

    //   if (result.error) {
    //     console.log('error:', result.error);
    //     console.log('error.meta:', result.error.meta);
    //     console.log('error.meta.errors[0]:', result.error.meta.errors[0]);
    //   }

    //   return result;
    // })

    const data = await searchWebGetSummary(query)

    const headers = new Headers({
      "Cache-Control": "no-store",
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Exception!', error.message);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

const searchWebGetSummary = async (query: string) => {
  console.log('process.env.BRAVE_API_KEY:', process.env.BRAVE_API_KEY);

  let response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${query}&summary=1`, {
    headers: {
      "X-Subscription-Token": process.env.BRAVE_API_KEY as string,
    },
  })
  const result = await response.json();

  if (result.error) {
    console.log('error:', result.error);
    console.log('error.meta:', result.error.meta);
    console.log('error.meta.errors[0]:', result.error.meta.errors[0]);

    throw(result.error.message? result.error.message: result.error)
  }

  let summaryKey;
  if(result.summarizer) summaryKey = result.summarizer.key.toString();
  console.log('summaryKey:', summaryKey);

  const request2Url = `https://api.search.brave.com/res/v1/summarizer/search?key=${summaryKey}&entity_info=1`;
  // console.log('request2Url:', request2Url);

  const response2 = await fetch(request2Url, {
      headers: {
        "X-Subscription-Token": process.env.BRAVE_API_KEY as string,
      },
    })
  

  const result2 = await response2.json();


  if (result2.error) {
    console.log('error:', result2.error);
    console.log('error.meta:', result2.error.meta);
    console.log('error.meta.errors[0]:', result2.error.meta.errors[0]);

    throw(result2.error.message? result2.error.message: result2.error)
  }
  // console.log('result2:', result2);

  return result2.summary[0]?.data;
}
