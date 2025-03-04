// React & Next.js imports
import { useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Search as SearchIcon } from "lucide-react";

const AMAZON_ASSOCIATES_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;

const fetchAmazonAffiliateLink = async (productName) => {
  console.log("Generating Amazon Search Link for:", productName);
  return `https://www.amazon.ca/s?k=${encodeURIComponent(productName)}&tag=${AMAZON_ASSOCIATES_TAG}`;
};

export default function SearchCanadianEh() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [affiliateLinks, setAffiliateLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    setAffiliateLinks([]);
    setError(null);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [
            { role: "system", content: "You are an AI that finds manufacturing locations of products and suggests Canadian alternatives. Provide a clear and concise response." },
            { role: "user", content: `Where is '${query}' made? If not in Canada, suggest a Canadian alternative.` }
          ],
          max_tokens: 200
        })
      });
      
      const data = await response.json();
      if (!data?.choices?.length || !data.choices[0]?.message?.content) {
        throw new Error("Unexpected API response format");
      }
      
      let aiResponse = data.choices[0].message.content;
      setResults(aiResponse);
      
      const productMatches = aiResponse.match(/"([^\"]+)"/g); // Extract product names
      if (productMatches) {
        console.log("Found product matches:", productMatches);
        const links = await Promise.all(
          productMatches.map(async (match) => {
            const alternativeProduct = match.replace(/"/g, "").trim();
            console.log("Generating Amazon search link for:", alternativeProduct);
            const link = await fetchAmazonAffiliateLink(alternativeProduct);
            return { name: alternativeProduct, link };
          })
        );
        setAffiliateLinks(links);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-bold text-red-600 uppercase tracking-wide mb-4">Search Canadian Eh?</h1>
      <p className="text-lg text-gray-600 mb-6">Find out where products are made and discover Canadian alternatives.</p>
      <div className="flex items-center gap-4 mb-6">
        <Input 
          type="text" 
          placeholder="Search for a product..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
        />
        <Button onClick={handleSearch} className="bg-red-600 text-white px-6 py-3 text-lg rounded-lg hover:bg-red-700">
          <SearchIcon className="mr-2" size={20} />
          Search
        </Button>
      </div>
      {loading && <p className="text-center text-gray-500">Searching...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {results && (
        <Card className="p-6 bg-white rounded-lg shadow-md mb-6">
          <CardContent>
            <div className="text-lg text-gray-800 leading-relaxed">{results}</div>
          </CardContent>
        </Card>
      )}
      {affiliateLinks.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Amazon Search Results</h2>
          <ul className="list-none">
            {affiliateLinks.map(({ name, link }, index) => (
              <li key={index} className="py-3 border-b border-gray-300 hover:bg-gray-100">
                <a href={link} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-blue-600">
                  {name} <span className="text-sm text-gray-500 ml-2">- View on Amazon</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

